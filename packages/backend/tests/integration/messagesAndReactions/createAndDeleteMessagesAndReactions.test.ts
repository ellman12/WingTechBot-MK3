import { sleep } from "@core/utils/timeUtils.js";
import type { TextChannel } from "discord.js";

import { getTestConfig } from "../../setup.js";
import { type MinimalTestBot, createMinimalTestBot } from "../../utils/createMinimalTestBot.js";
import {
    cleanupAllTestChannels,
    createMessagesAndReactions,
    createTemporaryTestChannel,
    createTestSchema,
    deleteTestChannel,
    dropTestSchema,
    getTestingEmotes,
    verifyTesterReactions,
    waitForAllReactionsRemoved,
    waitForMessageDeleted,
    waitForReactionsRemoved,
    waitForTesterReactions,
} from "../../utils/testUtils.js";
import { createTesterDiscordBot } from "../testBot/TesterDiscordBot.js";

const timeout = 360 * 1000;
const schemaName = "test_createAndDelete";

//prettier-ignore
describe("Messages and Reactions integration tests", async () => {
    let testChannel: TextChannel | null = null;
    let minimalBot: MinimalTestBot | null = null;
    let testerBot: Awaited<ReturnType<typeof createTesterDiscordBot>> | null = null;

    beforeAll(async () => {
        const testConfig = getTestConfig();

        await createTestSchema(schemaName, testConfig.database.url);

        minimalBot = await createMinimalTestBot(testConfig, schemaName, {
            messageArchiveService: true,
            reactionArchiveService: true,
        });

        await minimalBot.bot.start();
        await sleep(2000);

        testerBot = await createTesterDiscordBot();
    }, timeout);

    beforeEach(async () => {
        // Clean up any leftover reactions and messages from previous test runs
        if (minimalBot) {
            await minimalBot.db.deleteFrom("reactions").execute();
            await minimalBot.db.deleteFrom("messages").execute();
        }
    });

    afterEach(async () => {
        if (testChannel && minimalBot) {
            minimalBot.allowedChannels.delete(testChannel.id);
            await deleteTestChannel(testChannel);
            testChannel = null;
            await sleep(3000);
        }
    });

    afterAll(async () => {
        if (minimalBot) {
            await cleanupAllTestChannels(minimalBot.bot);
            await minimalBot.bot.stop();
            await minimalBot.db.destroy();
            
            const testConfig = getTestConfig();
            await dropTestSchema(schemaName, testConfig.database.url);
        }
        if (testerBot) {
            await testerBot.client.destroy();
        }
    });

    it("sends messages, adds reactions, removes both, verifies DB entries", async () => {
        if (!minimalBot || !testerBot) throw new Error("Test setup incomplete");

        const totalMessages = 2;
        const reactionsPerMessage = 2;
        const bot = minimalBot.bot;
        const db = minimalBot.db;
        const emotes = await getTestingEmotes(bot);

        const initialReactions = await db.selectFrom("reactions").selectAll().execute();
        if (initialReactions.length > 0) {
            console.log(`⚠️ Found ${initialReactions.length} reactions in database at test start. Cleaning up...`);
            const messageIds = [...new Set(initialReactions.map(r => r.message_id))];
            console.log(`   Reactions are for messages: ${messageIds.join(", ")}`);
            await db.deleteFrom("reactions").execute();
        }

        testChannel = await createTemporaryTestChannel(bot);
        minimalBot.addChannel(testChannel.id);
        const testerChannel = await testerBot.client.channels.fetch(testChannel.id) as TextChannel;

        const channel = testChannel;

        const messages = await createMessagesAndReactions(channel, testerChannel, totalMessages, reactionsPerMessage, emotes);
        await waitForTesterReactions(db, totalMessages * reactionsPerMessage);
        await verifyTesterReactions(db, totalMessages * reactionsPerMessage);

        let message = messages[0]!;
        await message.delete();
        await waitForMessageDeleted(db, message.id);
        await waitForReactionsRemoved(db, message.id);
        let foundMessages = await db.selectFrom("messages").where("id", "=", message.id).selectAll().execute();
        let foundReactions = await db.selectFrom("reactions").where("message_id", "=", message.id).selectAll().execute();
        expect(foundMessages).toHaveLength(0);
        expect(foundReactions).toHaveLength(0);

        message = messages[1]!;
        await message.reactions.removeAll();
        await waitForReactionsRemoved(db, message.id);
        foundReactions = await db.selectFrom("reactions").where("message_id", "=", message.id).selectAll().execute();
        expect(foundReactions).toHaveLength(0);

        await message.delete();
        await waitForMessageDeleted(db, message.id);
        foundMessages = await db.selectFrom("messages").where("id", "=", message.id).selectAll().execute();
        expect(foundMessages).toHaveLength(0);

        await waitForAllReactionsRemoved(db);
        foundReactions = await db.selectFrom("reactions").selectAll().execute();
        expect(foundReactions).toHaveLength(0);
    }, timeout);
});
