import { sleep } from "@core/utils/timeUtils.js";
import type { TextChannel } from "discord.js";

import { createApplication } from "@/main";
import type { App } from "@/main";

import { getTestConfig } from "../../setup.js";
import {
    cleanupAllTestChannels,
    createMessagesAndReactions,
    createTemporaryTestChannel,
    createTestSchema,
    deleteTestChannel,
    dropTestSchema,
    getTestingChannel,
    recreateDatabase,
    setUpIntegrationTest,
    verifyTesterReactions,
    waitForAllReactionsRemoved,
    waitForMessageDeleted,
    waitForReactionsRemoved,
    waitForTesterReactions,
} from "../../utils/testUtils.js";

const timeout = 360 * 1000;
const schemaName = "test_createAndDelete";

//prettier-ignore
describe("Messages and Reactions integration tests", async () => {
    let testChannel: TextChannel | null = null;
    let app: App | null = null;

    beforeAll(async () => {
        const testConfig = getTestConfig();

        // Create the test schema and run migrations BEFORE creating the app
        // The app's connection string needs the schema to exist
        await createTestSchema(schemaName, testConfig.database.url);

        app = await createApplication(testConfig, schemaName);
        await app.start();

        await sleep(2000);

        const channel = await getTestingChannel(app.discordBot);
        await channel.send("Starting Create/Delete Messages/Reactions tests");
    }, timeout);

    beforeEach(async () => {
        await sleep(5000);
        if (app) {
            const testConfig = getTestConfig();
            await recreateDatabase(app, schemaName, testConfig.database.url);
        }
    });

    afterEach(async () => {
        if (testChannel) {
            await deleteTestChannel(testChannel);
            testChannel = null;
            await sleep(3000);
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

    it("sends messages, adds reactions, removes both, verifies DB entries", async () => {
        const totalMessages = 2;
        const reactionsPerMessage = 2;
        const { bot, emotes, testerBot, db } = await setUpIntegrationTest(app!);

        // Verify database is clean at the start
        const initialReactions = await db.selectFrom("reactions").selectAll().execute();
        if (initialReactions.length > 0) {
            console.log(`⚠️ Found ${initialReactions.length} reactions in database at test start. Cleaning up...`);
            const messageIds = [...new Set(initialReactions.map(r => r.message_id))];
            console.log(`   Reactions are for messages: ${messageIds.join(", ")}`);
            // Delete all existing reactions to ensure clean state
            await db.deleteFrom("reactions").execute();
        }

        // Create temporary channels for this test
        testChannel = await createTemporaryTestChannel(bot, undefined, app!);
        const testerChannel = await testerBot.client.channels.fetch(testChannel.id) as TextChannel;

        const channel = testChannel;

        const messages = await createMessagesAndReactions(channel, testerChannel, totalMessages, reactionsPerMessage, emotes);
        // Wait for all reactions to be processed and saved to the database
        await waitForTesterReactions(db, totalMessages * reactionsPerMessage);
        await verifyTesterReactions(db, totalMessages * reactionsPerMessage);

        //Delete message, verify reactions cascade delete
        let message = messages[0]!;
        await message.delete();
        // Wait for message to be deleted from the database
        await waitForMessageDeleted(db, message.id);
        // Wait for reactions to be cascade-deleted (should be immediate, but wait to be sure)
        await waitForReactionsRemoved(db, message.id);
        let foundMessages = await db.selectFrom("messages").where("id", "=", message.id).selectAll().execute();
        let foundReactions = await db.selectFrom("reactions").where("message_id", "=", message.id).selectAll().execute();
        expect(foundMessages).toHaveLength(0);
        expect(foundReactions).toHaveLength(0);

        //Remove reactions first, then delete message
        message = messages[1]!;
        await message.reactions.removeAll();
        // Wait for all reactions to be removed from the database
        await waitForReactionsRemoved(db, message.id);
        foundReactions = await db.selectFrom("reactions").where("message_id", "=", message.id).selectAll().execute();
        expect(foundReactions).toHaveLength(0);

        await message.delete();
        // Wait for message to be deleted from the database
        await waitForMessageDeleted(db, message.id);
        foundMessages = await db.selectFrom("messages").where("id", "=", message.id).selectAll().execute();
        expect(foundMessages).toHaveLength(0);

        // Wait for all reactions to be removed (cascade delete should handle this, but wait to be sure)
        await waitForAllReactionsRemoved(db);
        // Verify all reactions are gone
        foundReactions = await db.selectFrom("reactions").selectAll().execute();
        expect(foundReactions).toHaveLength(0);
    }, timeout);
});
