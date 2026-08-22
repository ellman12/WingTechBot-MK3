import { sleep } from "@core/utils/timeUtils.js";
import type { Message, TextChannel } from "discord.js";

import { getTestConfig } from "../../setup.js";
import { type MinimalTestBot, createMinimalTestBot } from "../../utils/createMinimalTestBot.js";
import { createTemporaryTestChannel, createTestSchema } from "../../utils/testUtils.js";
import { createTesterDiscordBot } from "../testBot/TesterDiscordBot.js";

const timeout = 360 * 1000;
const delay = 6000;
const schemaName = "test_processAllChannels";

describe("processAllChannels", async () => {
    let testChannel: TextChannel | null = null;
    let minimalBot: MinimalTestBot | null = null;
    let testerBot: Awaited<ReturnType<typeof createTesterDiscordBot>> | null = null;

    beforeAll(async () => {
        const testConfig = getTestConfig();

        await createTestSchema(schemaName, testConfig.database.url);

        minimalBot = await createMinimalTestBot(testConfig, schemaName, {
            messageArchiveService: true,
        });

        await minimalBot.bot.start();
        await sleep(delay);

        testerBot = await createTesterDiscordBot();
    }, timeout);

    it("should read all messages and reactions on load", testReadAllMessagesAndReactionsOnLoad, timeout);

    async function testReadAllMessagesAndReactionsOnLoad() {
        if (!minimalBot || !testerBot) throw new Error("Test setup incomplete");

        const bot = minimalBot.bot;
        const db = minimalBot.db;
        const messageSync = minimalBot.messageSync;
        if (!messageSync) throw new Error("messageSync not available");

        testChannel = await createTemporaryTestChannel(bot);
        minimalBot.addChannel(testChannel.id);
        const testerChannel = (await testerBot.client.channels.fetch(testChannel.id)) as TextChannel;

        async function stopBot() {
            await bot.stop();
            await sleep(2000);
        }

        async function startBot() {
            await bot.start();
            const guild = await bot.client.guilds.fetch(process.env.DISCORD_GUILD_ID!);
            if (!testChannel || !messageSync) throw new Error("Test channel or messageSync not initialized");
            await messageSync.processAllChannels(guild, undefined, [testChannel.id]);
            // Note: Deletion detection is now integrated into processAllChannels
            await sleep(2000);
        }

        async function getAllMessages() {
            return await db.selectFrom("messages").selectAll().execute();
        }

        async function checkReactionsAmount(messageId: string, expected: number) {
            const reactions = await db.selectFrom("reactions").where("message_id", "=", messageId).selectAll().execute();
            expect(reactions).toHaveLength(expected);
        }

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

        await stopBot();

        for (const message of newMessages) {
            await message.delete();
        }

        await sleep(2000);

        await startBot();

        existingMessages = await getAllMessages();
        for (const message of newMessages) {
            expect(existingMessages.find(m => m.id === message.id)).toBeUndefined();
            // Reactions are automatically deleted via CASCADE when message is deleted
        }
    }
});
