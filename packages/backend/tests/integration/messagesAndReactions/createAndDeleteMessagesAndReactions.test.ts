import { sleep } from "@core/utils/timeUtils";
import type { TextChannel } from "discord.js";

import { getApp } from "@/main";

import { cleanupAllTestChannels, createMessagesAndReactions, createTemporaryTestChannel, deleteTestChannel, getTestingChannel, recreateDatabase, setUpIntegrationTest, verifyTesterReactions } from "../../utils/testUtils";

const timeout = 360 * 1000;

//prettier-ignore
describe("Messages and Reactions integration tests", async () => {
    let testChannel: TextChannel | null = null;

    beforeAll(async () => {
        await sleep(2000);

        const bot = getApp().discordBot;
        const channel = await getTestingChannel(bot);
        await channel.send("Starting Create/Delete Messages/Reactions tests");
    });

    beforeEach(async () => {
        await sleep(5000); // Increased delay to allow bot async operations to complete
        await recreateDatabase();
    });

    afterEach(async () => {
        if (testChannel) {
            await deleteTestChannel(testChannel);
            testChannel = null;
            await sleep(3000); // Allow bot operations to complete after channel deletion
        }
    });

    afterAll(async () => {
        const bot = getApp().discordBot;
        await cleanupAllTestChannels(bot);
    });

    it("sends messages, adds reactions, removes both, verifies DB entries", async () => {
        const totalMessages = 2;
        const reactionsPerMessage = 2;
        const { bot, emotes, testerBot, db } = await setUpIntegrationTest();

        // Create temporary channels for this test
        testChannel = await createTemporaryTestChannel(bot);
        const testerChannel = await testerBot.client.channels.fetch(testChannel.id) as TextChannel;

        const channel = testChannel;

        const messages = await createMessagesAndReactions(channel, testerChannel, totalMessages, reactionsPerMessage, emotes);
        await sleep(5000); // Reduced from 30s
        await verifyTesterReactions(db, totalMessages * reactionsPerMessage);

        //Delete message, verify reactions cascade delete
        let message = messages[0]!;
        await message.delete();
        await sleep(3000); // Reduced from 10s
        let foundMessages = await db.selectFrom("messages").where("id", "=", message.id).selectAll().execute();
        let foundReactions = await db.selectFrom("reactions").where("message_id", "=", message.id).selectAll().execute();
        expect(foundMessages).toHaveLength(0);
        expect(foundReactions).toHaveLength(0);

        //Remove reactions first, then delete message
        message = messages[1]!;
        await message.reactions.removeAll();
        await sleep(3000); // Reduced from 10s
        foundReactions = await db.selectFrom("reactions").where("message_id", "=", message.id).selectAll().execute();
        expect(foundReactions).toHaveLength(0);

        await message.delete();
        await sleep(3000); // Reduced from 10s
        foundMessages = await db.selectFrom("messages").where("id", "=", message.id).selectAll().execute();
        expect(foundMessages).toHaveLength(0);

        // Verify all reactions are gone
        foundReactions = await db.selectFrom("reactions").selectAll().execute();
        expect(foundReactions).toHaveLength(0);
    }, timeout);
});
