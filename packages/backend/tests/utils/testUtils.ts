import { loadConfig } from "@adapters/config/ConfigAdapter.js";
import { createMessageRepository } from "@adapters/repositories/MessageRepository.js";
import { createReactionEmoteRepository, defaultKarmaValues } from "@adapters/repositories/ReactionEmoteRepository.js";
import { createReactionRepository } from "@adapters/repositories/ReactionRepository.js";
import type { CreateMessageData } from "@core/entities/Message.js";
import { sleep } from "@core/utils/timeUtils.js";
import type { DB } from "@db/types.js";
import type { DiscordBot } from "@infrastructure/discord/DiscordBot.js";
import { type Guild, type Message, type TextChannel } from "discord.js";
import { promises as fs } from "fs";
import { Kysely, Migrator, PostgresDialect, sql } from "kysely";
import path from "path";
import { Pool } from "pg";
import { DataType, newDb } from "pg-mem";
import { pathToFileURL } from "url";
import { expect } from "vitest";

import type { App } from "@/main";

import { createTesterDiscordBot } from "../integration/testBot/TesterDiscordBot.js";
import { type TestReactionEmote, validEmotes } from "../testData/reactionEmotes.js";

const migrationsDir = path.resolve(__dirname, "../../database/migrations");

// Normalizes schema names to lowercase because PostgreSQL lowercases unquoted identifiers.
function sanitizeSchemaName(schemaName: string): string {
    return schemaName.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
}

// Sets search_path in connection string to ensure all pool connections use the correct schema.
function buildSchemaConnectionString(baseDatabaseUrl: string, schemaName: string): string {
    const sanitizedSchema = sanitizeSchemaName(schemaName);
    const separator = baseDatabaseUrl.includes("?") ? "&" : "?";
    return `${baseDatabaseUrl}${separator}options=-csearch_path=${sanitizedSchema}`;
}

// Verifies schema isolation by checking current_schema() matches expected.
async function verifyCurrentSchema(db: Kysely<DB>, expectedSchema: string): Promise<void> {
    const sanitizedSchema = sanitizeSchemaName(expectedSchema);
    const result = await sql<{ current_schema: string }>`SELECT current_schema()`.execute(db);
    const currentSchema = result.rows[0]?.current_schema;

    if (currentSchema !== sanitizedSchema) {
        throw new Error(`Schema verification failed: expected '${sanitizedSchema}', got '${currentSchema}'. ` + `This indicates the search_path is not properly configured.`);
    }
}

// Creates a migration provider compatible with both test and production environments.
function createMigrationProvider() {
    return {
        async getMigrations() {
            const files = await fs.readdir(migrationsDir);
            const migrations: Record<string, { up: (db: Kysely<DB>) => Promise<void>; down: (db: Kysely<DB>) => Promise<void> }> = {};

            for (const file of files) {
                if (file.endsWith(".d.ts") || file === "index.ts" || file === "index.js") {
                    continue;
                }

                const fileExt = file.split(".").pop();
                if (fileExt === "ts" || fileExt === "js") {
                    const name = file.replace(`.${fileExt}`, "");
                    const filePath = pathToFileURL(path.join(migrationsDir, file)).href;
                    const migration = await import(filePath);
                    migrations[name] = { up: migration.up, down: migration.down };
                }
            }

            return migrations;
        },
    };
}

// Runs migrations in a specific schema. Sets migrationTableSchema to prevent
// migration tables from being created in the public schema, which breaks test isolation.
async function runMigrationsInSchema(db: Kysely<DB>, schemaName: string): Promise<void> {
    const sanitizedSchema = sanitizeSchemaName(schemaName);

    await verifyCurrentSchema(db, schemaName);

    const migrationProvider = createMigrationProvider();

    const migrator = new Migrator({
        db,
        provider: migrationProvider,
        migrationTableSchema: sanitizedSchema,
    });

    const { error, results } = await migrator.migrateToLatest();

    if (error) {
        console.error(`❌ Migration failed for schema ${sanitizedSchema}:`, error);
        throw error;
    }

    if (results && results.length > 0) {
        console.log(
            `✅ Migrations executed for schema ${sanitizedSchema}:`,
            results.map(r => r.migrationName)
        );
    } else {
        console.log(`✅ Schema ${sanitizedSchema} is up to date`);
    }
}

// Executes a schema DDL operation (CREATE/DROP) using a temporary connection
// to the public schema. This is necessary because you can't drop a schema
// from a connection that has that schema in its search_path.
async function executeSchemaOperation(databaseUrl: string, operation: (db: Kysely<DB>, schemaName: string) => Promise<void>, schemaName: string): Promise<void> {
    const sanitizedSchema = sanitizeSchemaName(schemaName);
    const pool = new Pool({ connectionString: databaseUrl });
    const db = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });

    try {
        await operation(db, sanitizedSchema);
    } finally {
        await db.destroy();
    }
}

async function applyMigrations(kysely: Kysely<DB>) {
    //https://github.com/oguimbal/pg-mem/issues/379#issuecomment-2267505478
    //The fact that this works is unreal. This is kind of silly but Kysely migrations aren't compatible with pg-mem :(

    const migrationFiles = (await fs.readdir(migrationsDir)).filter(f => f.endsWith(".ts")).sort();
    for (const file of migrationFiles) {
        const { up } = await import(path.join(migrationsDir, file));
        if (typeof up !== "function") {
            console.warn(`⚠️ ${file} has no exported up() – skipping.`);
            continue;
        }

        await up(kysely);
    }
}

//Uses pg-mem to create an in-memory PostgreSQL database for tests.
export async function createTestDb(): Promise<Kysely<DB>> {
    const db = newDb();

    //pg-mem lacks this function so we fake it
    db.public.registerFunction({
        name: "timezone",
        args: [DataType.text, DataType.timestamptz],
        returns: DataType.timestamp,
        implementation: (tz: string, ts: Date) => {
            return ts;
        },
    });

    const pg = db.adapters.createPg();
    const pool = new Pool({ Client: pg.Client });
    const kysely = new Kysely<DB>({
        dialect: new PostgresDialect({ pool }),
    });

    await applyMigrations(kysely);

    return kysely;
}

export async function getTestingGuild(bot: DiscordBot): Promise<Guild> {
    const config = loadConfig();
    const guildId = config.discord.serverId;
    return bot.client.guilds.fetch(guildId);
}

export async function getTestingChannel(bot: DiscordBot): Promise<TextChannel> {
    const config = loadConfig();
    const botChannelId = config.discord.botChannelId;

    const guild = await getTestingGuild(bot);
    await guild.channels.fetch();
    return guild.channels.cache.get(botChannelId) as TextChannel;
}

export async function getTestingEmotes(bot: DiscordBot): Promise<TestReactionEmote[]> {
    const guild = await getTestingGuild(bot);
    const emotes: TestReactionEmote[] = [
        ["👀", ""],
        ["🐈‍⬛", ""],
    ];

    const names = ["upvote", "downvote", "silver", "gold", "platinum"];
    names.forEach(name => {
        const emote = guild.emojis.cache.find(e => e.name === name)!;
        emotes.push([emote.name!, emote.id]);
    });

    return emotes;
}

// Creates a test schema for database isolation.
// The app will run migrations in this schema when it starts.
// Each test file should use a unique schema name to avoid conflicts.
export const createTestSchema = async (schemaName: string, databaseUrl: string): Promise<void> => {
    // Create the schema using a public schema connection
    // The app's runMigrations() will handle migrating this schema
    await executeSchemaOperation(
        databaseUrl,
        async (db, schema) => {
            await sql`CREATE SCHEMA IF NOT EXISTS ${sql.id(schema)}`.execute(db);
        },
        schemaName
    );
};

// Drops a test schema and all its contents.
// This is used in afterAll hooks to clean up test schemas.
export const dropTestSchema = async (schemaName: string, databaseUrl: string): Promise<void> => {
    await executeSchemaOperation(
        databaseUrl,
        async (db, schema) => {
            await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
        },
        schemaName
    );
};

// Recreates a test schema by dropping and recreating it, then running all migrations.
// This is used in beforeEach hooks to ensure a clean database state for each test.
export const recreateDatabase = async (app: App, schemaName: string, baseDatabaseUrl: string): Promise<void> => {
    const sanitizedSchema = sanitizeSchemaName(schemaName);

    // Drop and recreate the schema using a public schema connection
    // We can't drop a schema from a connection that has it in search_path
    await executeSchemaOperation(
        baseDatabaseUrl,
        async (db, schema) => {
            await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE; CREATE SCHEMA ${sql.id(schema)}`.execute(db);
        },
        schemaName
    );

    // Create a fresh connection pool scoped to the schema for running migrations
    const schemaConnectionString = buildSchemaConnectionString(baseDatabaseUrl, schemaName);
    const schemaPool = new Pool({ connectionString: schemaConnectionString });
    const schemaDb = new Kysely<DB>({ dialect: new PostgresDialect({ pool: schemaPool }) });

    try {
        // Set search_path explicitly as a safety measure
        await sql`SET search_path TO ${sql.id(sanitizedSchema)}`.execute(schemaDb);

        // Run migrations in the fresh schema (includes the critical migrationTableSchema fix)
        await runMigrationsInSchema(schemaDb, schemaName);
    } finally {
        await schemaDb.destroy();
    }
};

// Track all created test channels for cleanup
const createdTestChannels = new Set<string>();

export async function createTemporaryTestChannel(bot: DiscordBot, channelName?: string): Promise<TextChannel> {
    const guild = await getTestingGuild(bot);
    const name = channelName || `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const channel = await guild.channels.create({
        name,
        type: 0, // GUILD_TEXT
    });

    createdTestChannels.add(channel.id);

    console.log(`📝 Created temporary test channel: ${channel.name} (${channel.id})`);
    return channel as TextChannel;
}

export async function deleteTestChannel(channel: TextChannel): Promise<void> {
    try {
        const channelName = channel.name;
        const channelId = channel.id;
        await channel.delete();
        createdTestChannels.delete(channelId);
        console.log(`🗑️ Deleted test channel: ${channelName} (${channelId})`);
    } catch (error) {
        console.warn(`Failed to delete test channel ${channel.id}:`, error);
    }
}

export async function cleanupAllTestChannels(bot: DiscordBot): Promise<void> {
    if (createdTestChannels.size === 0) {
        return;
    }

    // Check if bot is ready and client is not destroyed before attempting cleanup
    if (!bot.isReady() || !bot.client.token) {
        console.log(`⚠️ Bot is not ready or client is destroyed, skipping channel cleanup`);
        createdTestChannels.clear();
        return;
    }

    console.log(`🧹 Cleaning up ${createdTestChannels.size} remaining test channels...`);
    try {
        const guild = await getTestingGuild(bot);
        await guild.channels.fetch();

        const channelIds = Array.from(createdTestChannels);
        for (const channelId of channelIds) {
            try {
                const channel = guild.channels.cache.get(channelId);
                if (channel) {
                    await channel.delete();
                    createdTestChannels.delete(channelId);
                    console.log(`🗑️ Cleaned up test channel: ${channel.name} (${channelId})`);
                } else {
                    createdTestChannels.delete(channelId);
                }
            } catch (error) {
                console.warn(`Failed to cleanup test channel ${channelId}:`, error);
                createdTestChannels.delete(channelId);
            }
        }
    } catch (error) {
        console.error(`Error during channel cleanup:`, error);
        createdTestChannels.clear();
    }
}

export async function createTestReactions(db: Kysely<DB>, messageCount: number, reactionsPerMessage: number, baseMsgId: string) {
    const messages = createMessageRepository(db);
    const reactions = createReactionRepository(db);
    const emotes = createReactionEmoteRepository(db);

    for (let i = 0; i < messageCount; i++) {
        const messageId = baseMsgId + i.toString();
        await messages.create({
            id: messageId,
            authorId: "456",
            channelId: "789",
            content: "message content",
            createdAt: new Date(),
            editedAt: null,
        });

        for (let j = 0; j < reactionsPerMessage; j++) {
            const [name, discordId] = validEmotes[j] ?? ["", ""];
            const emote = await emotes.create(name, discordId);

            const foundEmote = await emotes.findById(emote.id);
            expect(foundEmote).not.toBeNull();

            const reactionData = { giverId: "123", receiverId: "456", channelId: "789", messageId, emoteId: emote.id };
            await reactions.create(reactionData);

            const foundReaction = await reactions.find(reactionData);
            expect(foundReaction).not.toBeNull();
        }
    }

    const expectedEmotes = reactionsPerMessage;
    const foundEmotes = await db.selectFrom("reaction_emotes").selectAll().execute();
    expect(foundEmotes.length).toEqual(expectedEmotes);

    const expectedReactions = messageCount * reactionsPerMessage;
    const foundReactions = await db.selectFrom("reactions").selectAll().execute();
    expect(foundReactions.length).toEqual(expectedReactions);
}

export async function setUpIntegrationTest(app: App) {
    const bot = app.discordBot;
    const channel = await getTestingChannel(bot);
    const emotes = await getTestingEmotes(bot);

    const db = app.getDatabase();

    const testerBot = await createTesterDiscordBot();
    const testerChannel = await getTestingChannel(testerBot);
    const testerBotId = testerBot.client.user!.id;

    return { bot, channel, emotes, testerBot, testerChannel, db, testerBotId };
}

//Creates fake message and reaction data in the DB.
export async function createFakeMessagesAndReactions(db: Kysely<DB>, totalMessages: number, reactionsPerMessage: number, emotes: TestReactionEmote[]) {
    const messages = createMessageRepository(db);
    const reactions = createReactionRepository(db);
    const emotesRepo = createReactionEmoteRepository(db);

    for (let i = 1; i <= totalMessages; i++) {
        const messageId = i.toString();
        const channelId = "200";
        const authorId = (i + 100).toString();

        const message: CreateMessageData = { id: messageId, authorId, channelId, content: `Message ${i.toString()}`, createdAt: new Date(), editedAt: null };
        await messages.create(message);

        for (let j = 0; j < reactionsPerMessage; j++) {
            const [name, discordId] = emotes[j]!;

            const karmaValue = defaultKarmaValues[name] ?? 0;
            const emote = await emotesRepo.create(name, discordId, karmaValue);
            await reactions.create({ giverId: authorId, receiverId: authorId, channelId, messageId, emoteId: emote.id });
            await reactions.create({ giverId: (300 + j).toString(), receiverId: authorId, channelId, messageId, emoteId: emote.id });
        }
    }

    expect(await db.selectFrom("reactions").selectAll().execute()).toHaveLength(totalMessages * reactionsPerMessage * 2);
}

export async function createMessagesAndReactions(botChannel: TextChannel, testerBotChannel: TextChannel, totalMessages: number, reactionsPerMessage: number, emotes: TestReactionEmote[]) {
    const messages: Message[] = [];

    for (let i = 0; i < totalMessages; i++) {
        const message = await botChannel.send(`Message ${i}: ${totalMessages} messages, ${reactionsPerMessage} reactions per message`);
        messages.push(message);

        // Fetch the specific message once for the tester bot
        const foundMessage = await testerBotChannel.messages.fetch(message.id);

        for (let j = 0; j < reactionsPerMessage; j++) {
            const [name, discordId] = emotes[j]!;
            await foundMessage.react(discordId || name);
            // Small delay between reactions to avoid rate limiting and ensure events are processed
            await sleep(500);
        }
    }

    // Give Discord time to propagate all reaction events before returning
    await sleep(1000);

    return messages;
}

//Verifies the DB only has reactions from the tester bot and in the right amount.
export async function verifyTesterReactions(db: Kysely<DB>, expectedReactions: number) {
    const reactions = await db.selectFrom("reactions").selectAll().execute();
    expect(reactions.length).toStrictEqual(expectedReactions);
    expect(reactions.filter(r => r.giver_id !== process.env.TESTER_DISCORD_CLIENT_ID).length).toStrictEqual(0);
}

//Polls the database until the expected number of reactions from the tester bot are found, or timeout.
export async function waitForTesterReactions(db: Kysely<DB>, expectedReactions: number, timeoutMs: number = 60000, pollIntervalMs: number = 1000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        const reactions = await db.selectFrom("reactions").selectAll().execute();
        const testerReactions = reactions.filter(r => r.giver_id === process.env.TESTER_DISCORD_CLIENT_ID);

        if (testerReactions.length === expectedReactions) {
            console.log(`✅ Found all ${expectedReactions} expected reactions after ${Date.now() - startTime}ms`);
            return;
        }

        if (testerReactions.length > expectedReactions) {
            // Too many reactions - log details for debugging
            const messageIds = [...new Set(testerReactions.map(r => r.message_id))];
            const reactionCounts = messageIds.map(msgId => ({
                messageId: msgId,
                count: testerReactions.filter(r => r.message_id === msgId).length,
            }));
            console.log(`⚠️ Found ${testerReactions.length} reactions (expected ${expectedReactions}). Reaction counts by message:`, reactionCounts);
        } else if (testerReactions.length > 0) {
            console.log(`⏳ Waiting for reactions: found ${testerReactions.length}/${expectedReactions}...`);
        }

        await sleep(pollIntervalMs);
    }

    // Final check - will throw if still not correct
    const reactions = await db.selectFrom("reactions").selectAll().execute();
    const testerReactions = reactions.filter(r => r.giver_id === process.env.TESTER_DISCORD_CLIENT_ID);
    console.log(`❌ Timeout waiting for reactions: found ${testerReactions.length}/${expectedReactions}`);
    if (testerReactions.length !== expectedReactions) {
        const messageIds = [...new Set(testerReactions.map(r => r.message_id))];
        const reactionCounts = messageIds.map(msgId => ({
            messageId: msgId,
            count: testerReactions.filter(r => r.message_id === msgId).length,
        }));
        console.log(`   Reaction counts by message:`, reactionCounts);
    }
    expect(testerReactions.length).toStrictEqual(expectedReactions);
}

//Polls the database until reactions for a specific message are removed, or timeout.
export async function waitForReactionsRemoved(db: Kysely<DB>, messageId: string, timeoutMs: number = 30000, pollIntervalMs: number = 500): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        const reactions = await db.selectFrom("reactions").where("message_id", "=", messageId).selectAll().execute();

        if (reactions.length === 0) {
            console.log(`✅ All reactions removed for message ${messageId} after ${Date.now() - startTime}ms`);
            return;
        }

        if (reactions.length > 0) {
            console.log(`⏳ Waiting for reactions to be removed: found ${reactions.length} remaining...`);
        }

        await sleep(pollIntervalMs);
    }

    // Final check - will throw if still not correct
    const reactions = await db.selectFrom("reactions").where("message_id", "=", messageId).selectAll().execute();
    console.log(`❌ Timeout waiting for reactions to be removed: found ${reactions.length} remaining`);
    expect(reactions.length).toStrictEqual(0);
}

//Polls the database until a message is deleted, or timeout.
export async function waitForMessageDeleted(db: Kysely<DB>, messageId: string, timeoutMs: number = 30000, pollIntervalMs: number = 500): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        const messages = await db.selectFrom("messages").where("id", "=", messageId).selectAll().execute();

        if (messages.length === 0) {
            console.log(`✅ Message ${messageId} deleted after ${Date.now() - startTime}ms`);
            return;
        }

        await sleep(pollIntervalMs);
    }

    // Final check - will throw if still not correct
    const messages = await db.selectFrom("messages").where("id", "=", messageId).selectAll().execute();
    console.log(`❌ Timeout waiting for message to be deleted: found ${messages.length} remaining`);
    expect(messages.length).toStrictEqual(0);
}

//Polls the database until all reactions are removed, or timeout.
export async function waitForAllReactionsRemoved(db: Kysely<DB>, timeoutMs: number = 30000, pollIntervalMs: number = 500): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        const reactions = await db.selectFrom("reactions").selectAll().execute();

        if (reactions.length === 0) {
            console.log(`✅ All reactions removed after ${Date.now() - startTime}ms`);
            return;
        }

        if (reactions.length > 0) {
            console.log(`⏳ Waiting for all reactions to be removed: found ${reactions.length} remaining...`);
            // Log details about remaining reactions for debugging
            const messageIds = [...new Set(reactions.map(r => r.message_id))];
            console.log(`   Remaining reactions are for messages: ${messageIds.join(", ")}`);
        }

        await sleep(pollIntervalMs);
    }

    // Final check - will throw if still not correct
    const reactions = await db.selectFrom("reactions").selectAll().execute();
    console.log(`❌ Timeout waiting for all reactions to be removed: found ${reactions.length} remaining`);
    if (reactions.length > 0) {
        const messageIds = [...new Set(reactions.map(r => r.message_id))];
        console.log(`   Remaining reactions are for messages: ${messageIds.join(", ")}`);
    }
    expect(reactions.length).toStrictEqual(0);
}

//Polls the channel until the bot's scold message appears, or timeout.
export async function waitForBotScoldMessage(channel: TextChannel, botId: string, emoteName: string, timeoutMs: number = 30000, pollIntervalMs: number = 1000): Promise<Message | undefined> {
    const { reactionScoldMessages } = await import("@core/services/AutoReactionService.js");
    const possibleMessages = reactionScoldMessages[emoteName];
    if (!possibleMessages) {
        throw new Error(`No scold messages found for emote: ${emoteName}`);
    }

    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        const fetchedMessages = await channel.messages.fetch({ limit: 10 });
        const botScoldMessage = fetchedMessages.find(m => m.author.id === botId && m.content.includes("<@") && possibleMessages.some(scoldMsg => m.content.includes(scoldMsg)));

        if (botScoldMessage) {
            console.log(`✅ Found bot scold message after ${Date.now() - startTime}ms`);
            return botScoldMessage;
        }

        await sleep(pollIntervalMs);
    }

    console.log(`❌ Timeout waiting for bot scold message in channel ${channel.id}`);
    return undefined;
}
