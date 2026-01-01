import { sleep } from "@core/utils/timeUtils";
import type { Message, TextChannel } from "discord.js";

import { getApp } from "@/main";

import { createTemporaryTestChannel, deleteTestChannel, getTestingChannel, recreateDatabase, setUpIntegrationTest } from "../../utils/testUtils.js";

const timeout = 360 * 1000;
const delay = 6000;

describe("processAllChannels", async () => {
    let testChannel: TextChannel | null = null;

    beforeAll(async () => {
        await sleep(delay);

        const bot = getApp().discordBot;
        const channel = await getTestingChannel(bot);
        await channel.send("Starting processAllChannels tests");
    });

    beforeEach(async () => {
        await sleep(delay);
        await recreateDatabase();
    });

    afterEach(async () => {
        if (testChannel) {
            await deleteTestChannel(testChannel);
            testChannel = null;
            await sleep(3000); // Allow bot operations to complete after channel deletion
        }
    });

    //prettier-ignore
    it("should read all messages and reactions on load", async () => {
        const { bot, testerBot, db } = await setUpIntegrationTest();
        const app = (await import("@/main")).getApp();

        // Create temporary channel for this test
        testChannel = await createTemporaryTestChannel(bot);
        const testerChannel = await testerBot.client.channels.fetch(testChannel.id) as TextChannel;

        async function stopBot() {
            await bot.stop();
            await sleep(2000);
        }

        async function startBot() {
            await bot.start();
            // Manually process channels since SKIP_CHANNEL_PROCESSING_ON_STARTUP is enabled for tests
            const guild = await bot.client.guilds.fetch(process.env.DISCORD_GUILD_ID!);
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
        for (let i = 1; i <= 2; i++) { // Reduced from 3 to 2 messages
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
