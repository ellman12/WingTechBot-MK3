import type { Message } from "discord.js";

import { getApp } from "@/main";

import { getTestingChannel, recreateDatabase, setUpIntegrationTest, sleep } from "../../utils/testUtils";

const timeout = 360 * 1000;
const delay = 3000;

describe("processAllChannels", async () => {
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

    //prettier-ignore
    it("should read all messages and reactions on load", async () => {
        const { bot, testerChannel, db } = await setUpIntegrationTest();

        //Go offline and send messages for bot to process later.
        await bot.stop();
        await sleep(6000);

        const newMessages: Message[] = [];
        for (let i = 1; i <= 3; i++) {
            const message = await testerChannel.send(`Message to process later #${i}`);
            newMessages.push(message);
            await message.react("👍");
            await message.react("👎");
        }

        let existingMessages = await db.selectFrom("messages").selectAll().execute();
        for (const message of newMessages) {
            expect(existingMessages.find(m => m.id === message.id)).toBeUndefined();
        }

        await bot.start();
        await sleep(delay * 4);

        existingMessages = await db.selectFrom("messages").selectAll().execute();
        for (const message of newMessages) {
            expect(existingMessages.find(m => m.id === message.id)).not.toBeUndefined();

            const reactions = await db.selectFrom("reactions").where("message_id", "=", message.id).selectAll().execute();
            expect(reactions).toHaveLength(2);
        }

        //Delete these new messages and make sure bot handles them properly on reload.
        await bot.stop();
        await sleep(6000);

        for (const message of newMessages) {
            await message.delete();
        }

        await bot.start();
        await sleep(delay * 4);

        existingMessages = await db.selectFrom("messages").selectAll().execute();
        for (const message of newMessages) {
            expect(existingMessages.find(m => m.id === message.id)).toBeUndefined();

            const reactions = await db.selectFrom("reactions").where("message_id", "=", message.id).selectAll().execute();
            expect(reactions).toHaveLength(0);
        }
    }, timeout);
});
