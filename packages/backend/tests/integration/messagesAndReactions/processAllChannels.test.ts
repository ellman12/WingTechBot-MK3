import { sleep } from "@core/utils/timeUtils.js";
import type { Message, TextChannel } from "discord.js";

import { createApplication } from "@/main";
import type { App } from "@/main";

import { getTestConfig } from "../../setup.js";
import { cleanupAllTestChannels, createTemporaryTestChannel, createTestSchema, deleteTestChannel, dropTestSchema, getTestingChannel, recreateDatabase, setUpIntegrationTest } from "../../utils/testUtils.js";

const timeout = 360 * 1000;
const delay = 6000;
const schemaName = "test_processAllChannels";

describe("processAllChannels", async () => {
    let testChannel: TextChannel | null = null;
    let app: App | null = null;

    beforeAll(async () => {
        const testConfig = getTestConfig();

        // Create the test schema and run migrations BEFORE creating the app
        // The app's connection string needs the schema to exist
        await createTestSchema(schemaName, testConfig.database.url);

        app = await createApplication(testConfig, schemaName);
        await app.start();

        await sleep(delay);

        const channel = await getTestingChannel(app.discordBot);
        await channel.send("Starting processAllChannels tests");
    }, timeout);

    beforeEach(async () => {
        await sleep(delay);
        if (app) {
            const testConfig = getTestConfig();
            await recreateDatabase(app, schemaName, testConfig.database.url);
        }
    });

    afterEach(async () => {
        if (testChannel && app) {
            // Re-fetch the channel from the current bot's client to ensure we have a valid token
            const guild = await app.discordBot.client.guilds.fetch(process.env.DISCORD_GUILD_ID!);
            const currentChannel = (await guild.channels.fetch(testChannel.id)) as TextChannel;
            if (currentChannel) {
                await deleteTestChannel(currentChannel);
            }
            testChannel = null;
            await sleep(3000); // Allow bot operations to complete after channel deletion
        }
    });

    afterAll(async () => {
        if (app) {
            await cleanupAllTestChannels(app.discordBot);
            const testConfig = getTestConfig();
            await app.stop();

            // Drop the test schema
            await dropTestSchema(schemaName, testConfig.database.url);
        }
    });

    //prettier-ignore
    it("should read all messages and reactions on load", async () => {
        const { bot, testerBot, db } = await setUpIntegrationTest(app!);

        // Create temporary channel for this test
        testChannel = await createTemporaryTestChannel(bot, undefined, app!);
        const testerChannel = await testerBot.client.channels.fetch(testChannel.id) as TextChannel;

        async function stopBot() {
            await bot.stop();
            await sleep(2000);
        }

        async function startBot() {
            await bot.start();
            // Manually process channels since SKIP_CHANNEL_PROCESSING_ON_STARTUP is enabled for tests
            const guild = await bot.client.guilds.fetch(process.env.DISCORD_GUILD_ID!);
            if (!testChannel || !app) throw new Error("Test channel or app not initialized");
            await app.messageArchiveService.processAllChannels(guild, undefined, [testChannel.id]);
            await app.messageArchiveService.removeDeletedMessages(guild);
            await sleep(2000); // Wait for processing to complete
        }

        async function getAllMessages() {
            return await db.selectFrom("messages").selectAll().execute();
        }

        async function checkReactionsAmount(messageId: string, expected: number) {
            const reactions = await db.selectFrom("reactions").where("message_id", "=", messageId).selectAll().execute();
            expect(reactions).toHaveLength(expected);
        }

        //Go offline and send messages for bot to process later.
        await stopBot();

        const newMessages: Message[] = [];
        for (let i = 1; i <= 2; i++) { 
            const message = await testerChannel.send(`Message to process later #${i}`);
            newMessages.push(message);
            await message.react("👍");
            await message.react("👎");
        }

        let existingMessages = await getAllMessages();
        for (const message of newMessages) {
            expect(existingMessages.find(m => m.id === message.id)).toBeUndefined();
        }

        await startBot();

        existingMessages = await getAllMessages();
        for (const message of newMessages) {
            expect(existingMessages.find(m => m.id === message.id)).not.toBeUndefined();

            await checkReactionsAmount(message.id, 2);
        }

        //Delete these new messages and make sure bot handles them properly on reload.
        await stopBot();

        for (const message of newMessages) {
            await message.delete();
        }

        // Wait a bit for Discord to process the deletions
        await sleep(2000);

        await startBot();

        existingMessages = await getAllMessages();
        for (const message of newMessages) {
            expect(existingMessages.find(m => m.id === message.id)).toBeUndefined();
            // Reactions are automatically deleted via CASCADE when message is deleted
        }
    }, timeout);
});
