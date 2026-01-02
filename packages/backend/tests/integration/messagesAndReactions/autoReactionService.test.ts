import { reactionScoldMessages } from "@core/services/AutoReactionService.js";
import { sleep } from "@core/utils/timeUtils.js";
import type { TextChannel } from "discord.js";

import { createApplication } from "@/main";
import type { App } from "@/main";

import { getTestConfig } from "../../setup.js";
import { cleanupAllTestChannels, createTemporaryTestChannel, createTestSchema, deleteTestChannel, dropTestSchema, getTestingChannel, recreateDatabase, setUpIntegrationTest } from "../../utils/testUtils.js";

const timeout = 120 * 1000;
const schemaName = "test_autoReactionService";

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
        await channel.send("Starting AutoReactionService tests");
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

    it("should scold self-reactions", async () => {
        const { bot, emotes, testerBot } = await setUpIntegrationTest(app!);

        // Create temporary channel for this test
        testChannel = await createTemporaryTestChannel(bot, undefined, app!);
        const testerChannel = await testerBot.client.channels.fetch(testChannel.id) as TextChannel;

        const message = await testerChannel.send("Reacting to this message");

        // Verify channel is registered
        const registeredChannels = app!.config.discord.restrictToChannelIds || [];
        console.log(`[Test] Channel ${testChannel.id} registered? ${registeredChannels.includes(testChannel.id)}`);
        console.log(`[Test] All registered channels: ${registeredChannels.join(", ")}`);

        // Test just one self-reaction instead of all three
        // emotes[2] should be "upvote" which has scold messages
        const [emoteName, emoteId] = emotes[2]!; // Just test one emote
        console.log(`[Test] Reacting with emote: ${emoteName} (${emoteId})`);
        await message.react(emoteId!);
        
        // Wait for the scold message to appear (poll until found or timeout)
        const possibleMessages = reactionScoldMessages[emoteName!]!;
        let botScoldMessage = null;
        const startTime = Date.now();
        const timeout = 30000; // 30 second timeout
        
        while (!botScoldMessage && Date.now() - startTime < timeout) {
            await sleep(1000); // Check every second
            const fetchedMessages = await testerChannel.messages.fetch({ limit: 10 });
            botScoldMessage = fetchedMessages.find(m => 
                m.author.id === bot.client.user!.id && 
                m.content.includes("<@") &&
                possibleMessages.some(scoldMsg => m.content.includes(scoldMsg))
            );
            
            if (!botScoldMessage) {
                console.log(`[Test] ⏳ Waiting for scold message... (${Math.floor((Date.now() - startTime) / 1000)}s)`);
            }
        }
        
        if (!botScoldMessage) {
            const fetchedMessages = await testerChannel.messages.fetch({ limit: 10 });
            console.log(`[Test] ❌ No scold message found after ${timeout}ms. Bot messages:`, 
                Array.from(fetchedMessages.values())
                    .filter(m => m.author.id === bot.client.user!.id)
                    .map(m => m.content)
            );
        }

        expect(botScoldMessage).not.toBeUndefined();
        const found = possibleMessages.find(m => botScoldMessage!.content.includes(m));
        expect(found).not.toBeUndefined();

        // No need to delete messages - channel cleanup in afterEach will handle it
    }, timeout);

    it("should reply 'Nice' when message contains funny substrings", async () => {
        const { bot, testerBot } = await setUpIntegrationTest(app!);

        // Create temporary channel for this test
        testChannel = await createTemporaryTestChannel(bot, undefined, app!);
        const testerChannel = await testerBot.client.channels.fetch(testChannel.id) as TextChannel;

        const message = await testerChannel.send("This number is 69420 lol");

        await sleep(2000); 

        const fetchedMessages = await testerChannel.messages.fetch({ limit: 2 });
        const reply = fetchedMessages.find(m => m.reference?.messageId === message.id);

        expect(reply).toBeTruthy();
        expect(reply!.content).toMatch(/Nice/);
        expect(reply!.content).toMatch(/\*\*69420\*\*/);

        // No need to delete messages - channel cleanup in afterEach will handle it
    }, timeout);

    it("should say 'I hardly know her!' to sentences with the last word ending in 'er'", async () => {
        const { bot, testerBot } = await setUpIntegrationTest(app!);

        // Create temporary channel for this test
        testChannel = await createTemporaryTestChannel(bot, undefined, app!);
        const testerChannel = await testerBot.client.channels.fetch(testChannel.id) as TextChannel;

        await testerChannel.send("This message is from WingTech Bot Tester");

        await sleep(2000); 

        const fetchedMessage = (await testerChannel.messages.fetch({ limit: 1 }))!.first()!;
        expect(fetchedMessage.content).toEqual("\"Tester\"? I hardly know her!");

        // No need to delete messages - channel cleanup in afterEach will handle it
    }, timeout);

}, timeout);
