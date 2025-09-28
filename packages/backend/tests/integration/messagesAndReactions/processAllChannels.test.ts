import type { Message } from "discord.js";

import { getApp } from "@/main";

import { getTestingChannel, recreateDatabase, setUpIntegrationTest, sleep } from "../../utils/testUtils";

const timeout = 2 * 60 * 1000;
const delay = 2000;

describe("processAllChannels", async () => {
    beforeAll(async () => {
        await sleep(delay);

        const bot = getApp().discordBot;
        const channel = await getTestingChannel(bot);
        await channel.send("Starting processAllChannels tests");
    });

    afterAll(async () => {
        const bot = getApp().discordBot;
        const channel = await getTestingChannel(bot);
        await channel.send("Finish processAllChannels tests");
    });

    beforeEach(async () => {
        await sleep(delay);

        await recreateDatabase();
    });

    it(
        "should read all messages and reactions on load",
        async () => {
            const { bot, testerChannel, db } = await setUpIntegrationTest();

            //Go offline and send messages for bot to process later.
            await bot.stop();

            const messages: Message[] = [];
            for (let i = 1; i <= 3; i++) {
                messages.push(await testerChannel.send(`Message to process later #${i}`));
            }

            let existingMessages = await db.selectFrom("messages").selectAll().execute();
            for (const message of messages) {
                expect(existingMessages.find(m => m.id === message.id)).toBeUndefined();
            }

            await bot.start();
            await sleep(delay * 4);

            existingMessages = await db.selectFrom("messages").selectAll().execute();
            for (const message of messages) {
                expect(existingMessages.find(m => m.id === message.id)).not.toBeUndefined();
            }

            for (const message of messages) {
                await message.delete();
            }
        },
        timeout
    );
});
