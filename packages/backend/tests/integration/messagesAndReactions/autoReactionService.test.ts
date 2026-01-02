import { reactionScoldMessages } from "@core/services/AutoReactionService.js";
import { sleep } from "@core/utils/timeUtils.js";
import type { TextChannel } from "discord.js";

import { getTestConfig } from "../../setup.js";
import { type MinimalTestBot, createMinimalTestBot } from "../../utils/createMinimalTestBot.js";
import { cleanupAllTestChannels, createTemporaryTestChannel, createTestSchema, deleteTestChannel, dropTestSchema, getTestingEmotes, waitForBotScoldMessage } from "../../utils/testUtils.js";
import { createTesterDiscordBot } from "../testBot/TesterDiscordBot.js";

const timeout = 120 * 1000;
const schemaName = "test_autoReactionService";

//prettier-ignore
describe("Messages and Reactions integration tests", async () => {
    let testChannel: TextChannel | null = null;
    let minimalBot: MinimalTestBot | null = null;
    let testerBot: Awaited<ReturnType<typeof createTesterDiscordBot>> | null = null;

    beforeAll(async () => {
        const testConfig = getTestConfig();

        await createTestSchema(schemaName, testConfig.database.url);

        minimalBot = await createMinimalTestBot(testConfig, schemaName, {
            autoReactionService: true,
            reactionArchiveService: true,
        });

        await minimalBot.bot.start();
        await sleep(2000);

        testerBot = await createTesterDiscordBot();
    }, timeout);

    afterEach(async () => {
        if (testChannel && minimalBot) {
            minimalBot.allowedChannels.delete(testChannel.id);
            await deleteTestChannel(testChannel);
            testChannel = null;
            await sleep(3000); // Allow bot operations to complete after channel deletion
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

    it("should scold self-reactions", async () => {
        if (!minimalBot || !testerBot) throw new Error("Test setup incomplete");

        const bot = minimalBot.bot;
        const emotes = await getTestingEmotes(bot);

        testChannel = await createTemporaryTestChannel(bot);
        minimalBot.addChannel(testChannel.id);
        const testerChannel = await testerBot.client.channels.fetch(testChannel.id) as TextChannel;

        const message = await testerChannel.send("Reacting to this message");

        const [emoteName, emoteId] = emotes[2]!;
        await message.react(emoteId!);
        
        const botScoldMessage = await waitForBotScoldMessage(testerChannel, bot.client.user!.id, emoteName!);

        expect(botScoldMessage).not.toBeUndefined();
        const possibleMessages = reactionScoldMessages[emoteName!]!;
        const found = possibleMessages.find(m => botScoldMessage!.content.includes(m));
        expect(found).not.toBeUndefined();
    }, timeout);

    it("should reply 'Nice' when message contains funny substrings", async () => {
        if (!minimalBot || !testerBot) throw new Error("Test setup incomplete");

        const bot = minimalBot.bot;

        testChannel = await createTemporaryTestChannel(bot);
        minimalBot.addChannel(testChannel.id);
        const testerChannel = await testerBot.client.channels.fetch(testChannel.id) as TextChannel;

        const message = await testerChannel.send("This number is 69420 lol");

        await sleep(2000); 

        const fetchedMessages = await testerChannel.messages.fetch({ limit: 2 });
        const reply = fetchedMessages.find(m => m.reference?.messageId === message.id);

        expect(reply).toBeTruthy();
        expect(reply!.content).toMatch(/Nice/);
        expect(reply!.content).toMatch(/\*\*69420\*\*/);
    }, timeout);

    it("should say 'I hardly know her!' to sentences with the last word ending in 'er'", async () => {
        if (!minimalBot || !testerBot) throw new Error("Test setup incomplete");

        const bot = minimalBot.bot;

        testChannel = await createTemporaryTestChannel(bot);
        minimalBot.addChannel(testChannel.id);
        const testerChannel = await testerBot.client.channels.fetch(testChannel.id) as TextChannel;

        await testerChannel.send("This message is from WingTech Bot Tester");

        await sleep(2000); 

        const fetchedMessage = (await testerChannel.messages.fetch({ limit: 1 }))!.first()!;
        expect(fetchedMessage.content).toEqual("\"Tester\"? I hardly know her!");
    }, timeout);

}, timeout);
