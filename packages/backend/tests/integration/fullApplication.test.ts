import { sleep } from "@core/utils/timeUtils.js";
import type { TextChannel } from "discord.js";

import { type App, createApplication } from "@/main.js";

import { getTestConfig } from "../setup.js";
import { cleanupAllTestChannels, createTemporaryTestChannel, createTestSchema, deleteTestChannel, dropTestSchema, getTestingEmotes } from "../utils/testUtils.js";
import { createTesterDiscordBot } from "./testBot/TesterDiscordBot.js";

const timeout = 360 * 1000;
const schemaName = "test_fullApplication";

describe.concurrent("Full application integration test", async () => {
    let app: App | null = null;
    let testerBot: Awaited<ReturnType<typeof createTesterDiscordBot>> | null = null;

    beforeAll(async () => {
        const testConfig = getTestConfig();

        await createTestSchema(schemaName, testConfig.database.url);

        app = await createApplication(testConfig, schemaName);
        await app.start();
        await sleep(3000);

        testerBot = await createTesterDiscordBot();
    }, timeout);

    afterAll(async () => {
        if (app) {
            await cleanupAllTestChannels(app.discordBot);
            if (app.isReady()) {
                await app.stop();
            }
            await app.getDatabase().destroy();

            const testConfig = getTestConfig();
            await dropTestSchema(schemaName, testConfig.database.url);
        }
        if (testerBot) {
            await testerBot.client.destroy();
        }
    }, timeout);

    it("should handle message and reaction events end-to-end", testMessageAndReactionEvents, timeout);
    async function testMessageAndReactionEvents() {
        if (!app || !testerBot) throw new Error("Test setup incomplete");

        const bot = app.discordBot;
        const db = app.getDatabase();
        const emotes = await getTestingEmotes(bot);

        const testChannel = await createTemporaryTestChannel(bot);
        const testerChannel = (await testerBot.client.channels.fetch(testChannel.id)) as TextChannel;

        const message = await testerChannel.send("Test message");
        const [emoteName, emoteId] = emotes[0]!;
        await message.react(emoteId || emoteName);
        await sleep(2000);

        const dbMessage = await db.selectFrom("messages").where("id", "=", message.id).selectAll().executeTakeFirst();
        expect(dbMessage).toBeDefined();
        expect(dbMessage!.content).toBe("Test message");

        const reactions = await db.selectFrom("reactions").where("message_id", "=", message.id).where("giver_id", "=", process.env.TESTER_DISCORD_CLIENT_ID!).selectAll().execute();
        expect(reactions).toHaveLength(1);

        const cleanupGuild = await bot.client.guilds.fetch(process.env.DISCORD_GUILD_ID!);
        const cleanupChannel = (await cleanupGuild.channels.fetch(testChannel.id)) as TextChannel | null;
        if (cleanupChannel) {
            await deleteTestChannel(cleanupChannel);
        }
    }

    it("should handle auto-reactions end-to-end", testAutoReactions, timeout);
    async function testAutoReactions() {
        if (!app || !testerBot) throw new Error("Test setup incomplete");

        const bot = app.discordBot;
        const testChannel = await createTemporaryTestChannel(bot);
        const testerChannel = (await testerBot.client.channels.fetch(testChannel.id)) as TextChannel;

        const message = await testerChannel.send("This number is 69420 lol");
        await sleep(3000);

        const fetchedMessages = await testerChannel.messages.fetch({ limit: 2 });
        const reply = fetchedMessages.find(m => m.reference?.messageId === message.id);

        expect(reply).toBeTruthy();
        expect(reply!.content).toMatch(/Nice/);
        expect(reply!.content).toMatch(/\*\*69420\*\*/);

        const cleanupGuild = await bot.client.guilds.fetch(process.env.DISCORD_GUILD_ID!);
        const cleanupChannel = (await cleanupGuild.channels.fetch(testChannel.id)) as TextChannel | null;
        if (cleanupChannel) {
            await deleteTestChannel(cleanupChannel);
        }
    }
});
