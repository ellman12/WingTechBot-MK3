import { createMessageRepository } from "@adapters/repositories/MessageRepository";
import { createReactionEmoteRepository } from "@adapters/repositories/ReactionEmoteRepository";
import { createReactionRepository } from "@adapters/repositories/ReactionRepository";
import { getKyselyForMigrations, runMigrations } from "@db/migrations";
import type { DB } from "@db/types";
import { getKysely } from "@infrastructure/database/DatabaseConnection";
import type { DiscordBot } from "@infrastructure/discord/DiscordBot";
import { type Guild, type Message, type TextChannel } from "discord.js";
import { promises as fs } from "fs";
import { Kysely, PostgresDialect, sql } from "kysely";
import path from "path";
import { Pool } from "pg";
import { DataType, newDb } from "pg-mem";
import { expect } from "vitest";

import { getApp } from "@/main";

import { createTesterDiscordBot } from "../integration/testBot/TesterDiscordBot";
import { type TestReactionEmote, validEmotes } from "../testData/reactionEmotes";

const migrationsDir = path.resolve(__dirname, "../../database/migrations");

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

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getTestingGuild(bot: DiscordBot): Promise<Guild> {
    return bot.client.guilds.fetch(process.env.DISCORD_GUILD_ID!);
}

export async function getTestingChannel(bot: DiscordBot): Promise<TextChannel> {
    const guild = await getTestingGuild(bot);
    await guild.channels.fetch();
    return guild.channels.cache.get(process.env.DISCORD_BOT_CHANNEL_ID!) as TextChannel;
}

export async function getTestingEmotes(bot: DiscordBot): Promise<TestReactionEmote[]> {
    const guild = await getTestingGuild(bot);
    const emotes: TestReactionEmote[] = [
        ["👀", null],
        ["🐈‍⬛", null],
    ];

    const names = ["upvote", "downvote", "silver", "gold", "platinum"];
    names.forEach(name => {
        const emote = guild.emojis.cache.find(e => e.name === name)!;
        emotes.push([emote.name!, emote.id]);
    });

    return emotes;
}

export const recreateDatabase = async (): Promise<void> => {
    const db = getKyselyForMigrations();
    await sql`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`.execute(db);
    await runMigrations();
};

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
            const [name, id] = validEmotes[j] ?? ["", null];
            const emote = await emotes.findOrCreate(name, id);

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

export async function setUpIntegrationTest() {
    const bot = getApp().discordBot;
    const channel = await getTestingChannel(bot);
    const emotes = await getTestingEmotes(bot);

    const db = getKysely();

    const testerBot = await createTesterDiscordBot();
    const testerChannel = await getTestingChannel(testerBot);
    const testerBotId = testerBot.client.user!.id;

    return { bot, channel, emotes, testerBot, testerChannel, db, testerBotId };
}

export async function createMessagesAndReactions(botChannel: TextChannel, testerBotChannel: TextChannel, totalMessages: number, reactionsPerMessage: number, emotes: TestReactionEmote[]) {
    const messages: Message[] = [];

    for (let i = 0; i < totalMessages; i++) {
        const message = await botChannel.send(`Message ${i}: ${totalMessages} messages, ${reactionsPerMessage} reactions per message`);
        messages.push(message);

        for (let j = 0; j < reactionsPerMessage; j++) {
            const [name, discordId] = emotes[j]!;

            await testerBotChannel.messages.fetch();
            const foundMessage = testerBotChannel.messages.cache.get(message.id)!;
            await foundMessage.react(discordId ?? name);
        }
    }

    return messages;
}

//Verifies the DB only has reactions from the tester bot and in the right amount.
export async function verifyTesterReactions(db: Kysely<DB>, expectedReactions: number) {
    const reactions = await db.selectFrom("reactions").selectAll().execute();
    expect(reactions.length).toStrictEqual(expectedReactions);
    expect(reactions.filter(r => r.giver_id !== process.env.TESTER_DISCORD_CLIENT_ID).length).toStrictEqual(0);
}
