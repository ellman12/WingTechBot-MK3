import type { Message } from "discord.js";

import { getApp } from "@/main";

import { getTestingChannel, recreateDatabase, setUpIntegrationTest, sleep } from "../../utils/testUtils.js";

const timeout = 360 * 1000;
const delay = 6000;

//Note: this test throws several errors while running. However, I don't think they're actually issues..? Everything seems to work fine.
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

        async function stopBot() {
            await bot.stop();
            await sleep(2000);
        }

        async function startBot() {
            await bot.start();
            await sleep(24000); //Makes sure bot has enough time to update data.
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
        for (let i = 1; i <= 3; i++) {
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

        //Add additional reactions while bot offline to ensure handles them properly on reload.
        await stopBot();

        for (const message of newMessages) {
            await message.react("🤡");
            await message.react("👨🏼");
        }

        await startBot();

        existingMessages = await getAllMessages();
        for (const message of newMessages) {
            expect(existingMessages.find(m => m.id === message.id)).not.toBeUndefined();

            await checkReactionsAmount(message.id, 4);
        }

        //Remove some reactions while bot offline to ensure handles them properly on reload.
        await stopBot()

        for (const message of newMessages) {
            await message.reactions.cache.get("👍")!.remove()
            await message.reactions.cache.get("👎")!.remove()
        }

        await startBot()

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

        await startBot();

        existingMessages = await getAllMessages();
        for (const message of newMessages) {
            expect(existingMessages.find(m => m.id === message.id)).toBeUndefined();

            await checkReactionsAmount(message.id, 0);
        }
    }, timeout);
});
