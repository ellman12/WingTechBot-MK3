import { sleep } from "@core/utils/timeUtils.js";
import type { TextChannel } from "discord.js";

import { getTestConfig } from "../../setup.js";
import { type MinimalTestBot, createMinimalTestBot } from "../../utils/createMinimalTestBot.js";
import { cleanupAllTestChannels, createTemporaryTestChannel, createTestSchema, deleteTestChannel, dropTestSchema } from "../../utils/testUtils.js";
import { createTesterDiscordBot } from "../testBot/TesterDiscordBot.js";

const timeout = 360 * 1000;
const schemaName = "test_DiscordChatService";

describe("DiscordChatService", async () => {
    let testChannel: TextChannel | null = null;
    let minimalBot: MinimalTestBot | null = null;
    let testerBot: Awaited<ReturnType<typeof createTesterDiscordBot>> | null = null;

    beforeAll(async () => {
        const testConfig = getTestConfig();

        await createTestSchema(schemaName, testConfig.database.url);

        minimalBot = await createMinimalTestBot(testConfig, schemaName, {});

        await minimalBot.bot.start();
        await sleep(6000);

        testerBot = await createTesterDiscordBot();
    }, timeout);

    afterEach(async () => {
        if (testChannel && minimalBot) {
            minimalBot.allowedChannels.delete(testChannel.id);
            // Re-fetch the channel from the current bot's client to ensure we have a valid token
            const guild = await minimalBot.bot.client.guilds.fetch(process.env.DISCORD_GUILD_ID!);
            const currentChannel = (await guild.channels.fetch(testChannel.id)) as TextChannel;
            if (currentChannel) {
                await deleteTestChannel(currentChannel);
            }
            testChannel = null;
            await sleep(3000); // Allow bot operations to complete after channel deletion
        }
    });

    afterAll(async () => {
        if (minimalBot) {
            // cleanupAllTestChannels already checks if bot is ready, so safe to call
            await cleanupAllTestChannels(minimalBot.bot);
            // Only stop if still ready (cleanupAllTestChannels might have skipped if not ready)
            if (minimalBot.bot.isReady()) {
                await minimalBot.bot.stop();
            }
            await minimalBot.db.destroy();

            const testConfig = getTestConfig();
            await dropTestSchema(schemaName, testConfig.database.url);
        }
        if (testerBot) {
            await testerBot.client.destroy();
        }
    });

    it("should properly send normal-length messages", async () => {
        if (!minimalBot || !testerBot) throw new Error("Test setup incomplete");

        testChannel = await createTemporaryTestChannel(minimalBot.bot);
        minimalBot.addChannel(testChannel.id);
        const testerChannel = (await testerBot.client.channels.fetch(testChannel.id)) as TextChannel;

        await minimalBot!.discordChatService!.sendMessage("This is a normal length message", testerChannel);
    });

    it("should properly split long messages when set to split mode", async () => {
        if (!minimalBot || !testerBot) throw new Error("Test setup incomplete");

        testChannel = await createTemporaryTestChannel(minimalBot.bot);
        minimalBot.addChannel(testChannel.id);
        const testerChannel = (await testerBot.client.channels.fetch(testChannel.id)) as TextChannel;

        await minimalBot!.discordChatService!.sendMessage(`This is a normal length sentence. ${"e".repeat(1300)}. This is the last sentence.`, testerChannel);
    });

    it("should properly send a message as a file when set to file mode", async () => {
        if (!minimalBot || !testerBot) throw new Error("Test setup incomplete");

        testChannel = await createTemporaryTestChannel(minimalBot.bot);
        minimalBot.addChannel(testChannel.id);
        const testerChannel = (await testerBot.client.channels.fetch(testChannel.id)) as TextChannel;

        await minimalBot!.discordChatService!.sendMessage(`This is a normal length sentence. ${"e".repeat(3000)}`, testerChannel, "file");
    });
});
