import { getApp } from "@/main";

import { createMessagesAndReactions, getTestingChannel, recreateDatabase, setUpIntegrationTest, sleep, verifyTesterReactions } from "../../utils/testUtils";

const timeout = 360 * 1000;

//prettier-ignore
describe("Messages and Reactions integration tests", async () => {
    beforeAll(async () => {
        await sleep(2000);

        const bot = getApp().discordBot;
        const channel = await getTestingChannel(bot);
        await channel.send("Starting Create/Delete Messages/Reactions tests");
    });

    beforeEach(async () => {
        await sleep(2000);
        await recreateDatabase();
    });

    it("sends messages, adds reactions, removes both, verifies DB entries", async () => {
        const totalMessages = 3;
        const reactionsPerMessage = 4;
        const { channel, emotes, testerChannel, db } = await setUpIntegrationTest();

        const messages = await createMessagesAndReactions(channel, testerChannel, totalMessages, reactionsPerMessage, emotes);
        await sleep(30000);
        await verifyTesterReactions(db, totalMessages * reactionsPerMessage);

        //Delete message, verify reactions gone
        let message = messages[0]!;
        await message.delete();
        await sleep(10000);
        let foundMessages = await db.selectFrom("messages").where("id", "=", message.id).selectAll().execute();
        let foundReactions = await db.selectFrom("reactions").where("message_id", "=", message.id).selectAll().execute();
        expect(foundMessages).toHaveLength(0);
        expect(foundReactions).toHaveLength(0);

        //Remove reactions for message, then delete message
        message = messages[1]!;
        await message.reactions.removeAll();
        await sleep(8000);
        foundReactions = await db.selectFrom("reactions").where("message_id", "=", message.id).selectAll().execute();
        expect(foundReactions).toHaveLength(0);

        await message.delete();
        await sleep(8000);
        foundMessages = await db.selectFrom("messages").where("id", "=", message.id).selectAll().execute();
        expect(foundMessages).toHaveLength(0);

        //Remove all reactions with specific emotes, then delete message
        message = messages[2]!;
        for (let i = 0; i < reactionsPerMessage; i++) {
            const [name, discordId] = emotes[i]!;
            const reaction = message.reactions.cache.find(r => r.emoji.name === name && r.emoji.id === discordId)!;
            await reaction.remove();
        }

        await sleep(8000);
        foundReactions = await db.selectFrom("reactions").where("message_id", "=", message.id).selectAll().execute();
        expect(foundReactions).toHaveLength(0);

        await message.delete();
        await sleep(8000);
        foundMessages = await db.selectFrom("messages").where("id", "=", message.id).selectAll().execute();
        expect(foundMessages).toHaveLength(0);

        foundReactions = await db.selectFrom("reactions").selectAll().execute();
        expect(foundReactions).toHaveLength(0);
    }, timeout);
});
