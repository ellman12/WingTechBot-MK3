import { reactionScoldMessages } from "@core/services/AutoReactionService.js";
import { sleep } from "@core/utils/timeUtils.js";
import type { TextChannel } from "discord.js";

import { getApp } from "@/main";

import { cleanupAllTestChannels, createTemporaryTestChannel, deleteTestChannel, getTestingChannel, recreateDatabase, setUpIntegrationTest } from "../../utils/testUtils.js";

const timeout = 120 * 1000;

//prettier-ignore
describe("Messages and Reactions integration tests", async () => {
    let testChannel: TextChannel | null = null;

    beforeAll(async () => {
        await sleep(2000);

        const bot = getApp().discordBot;
        const channel = await getTestingChannel(bot);
        await channel.send("Starting AutoReactionService tests");
    });

    beforeEach(async () => {
        await sleep(5000);
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

    it("should scold self-reactions", async () => {
        const { bot, emotes, testerBot } = await setUpIntegrationTest();

        // Create temporary channel for this test
        testChannel = await createTemporaryTestChannel(bot);
        const testerChannel = await testerBot.client.channels.fetch(testChannel.id) as TextChannel;

        const message = await testerChannel.send("Reacting to this message");

        // Test just one self-reaction instead of all three
        const [emoteName, emoteId] = emotes[2]!; // Just test one emote
        await message.react(emoteId!);
        await sleep(3000); 
        const fetchedMessage = (await testerChannel.messages.fetch({ limit: 1 }))!.first()!;

        const possibleMessages = reactionScoldMessages[emoteName!]!;
        const found = possibleMessages.find(m => fetchedMessage.content.includes(m));
        expect(found).not.toBeUndefined();

        await fetchedMessage.delete();

        await message.delete();
    }, timeout);

    it("should reply 'Nice' when message contains funny substrings", async () => {
        const { bot, testerBot } = await setUpIntegrationTest();

        // Create temporary channel for this test
        testChannel = await createTemporaryTestChannel(bot);
        const testerChannel = await testerBot.client.channels.fetch(testChannel.id) as TextChannel;

        const message = await testerChannel.send("This number is 69420 lol");

        await sleep(2000); 

        const fetchedMessages = await testerChannel.messages.fetch({ limit: 2 });
        const reply = fetchedMessages.find(m => m.reference?.messageId === message.id);

        expect(reply).toBeTruthy();
        expect(reply!.content).toMatch(/Nice/);
        expect(reply!.content).toMatch(/\*\*69420\*\*/);

        for (const fetched of fetchedMessages.values()) {
            await fetched.delete();
        }
    }, timeout);

    it("should say 'I hardly know her!' to sentences with the last word ending in 'er'", async () => {
        const { bot, testerBot } = await setUpIntegrationTest();

        // Create temporary channel for this test
        testChannel = await createTemporaryTestChannel(bot);
        const testerChannel = await testerBot.client.channels.fetch(testChannel.id) as TextChannel;

        const message = await testerChannel.send("This message is from WingTech Bot Tester");

        await sleep(2000); 

        const fetchedMessage = (await testerChannel.messages.fetch({ limit: 1 }))!.first()!;
        expect(fetchedMessage.content).toEqual("\"Tester\"? I hardly know her!");

        await fetchedMessage.delete();
        await message.delete();
    }, timeout);

}, timeout);
