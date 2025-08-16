import { afterAll, beforeAll, beforeEach, describe } from "vitest";

import { getApp } from "@/main";

import { checkReactionAmount, createMessagesAndReactions, getTestingChannel, recreateDatabase, setUpIntegrationTest, sleep } from "../../utils/testUtils";

type MessageTestData = [number, number];

const data: MessageTestData[] = [
    [1, 1],
    [2, 1],
    [1, 2],
    [2, 2],
    [4, 2],
    [4, 4],
];

const timeout = 120 * 1000;

beforeAll(async () => {
    await sleep(2000);

    const bot = getApp().discordBot;
    const channel = await getTestingChannel(bot);
    await channel.send("Starting Remove Reactions for Message tests");
});

afterAll(async () => {
    const bot = getApp().discordBot;
    const channel = await getTestingChannel(bot);
    await channel.send("Finish Remove Reactions for Message tests");
});

beforeEach(async () => {
    await sleep(2000);

    await recreateDatabase();
});

describe("Remove Reactions For Message", () => {
    test.each(data)(
        "%s messages, %s reactions per message",
        async (totalMessages, reactionsPerMessage) => {
            const { channel, emotes, testerChannel, db } = await setUpIntegrationTest();
            await testerChannel.fetch(true);
            const messages = await createMessagesAndReactions(channel, testerChannel, totalMessages, reactionsPerMessage, emotes);

            await sleep(12 * 1000);
            await checkReactionAmount(db, totalMessages * reactionsPerMessage);

            for (const id of messages.map(m => m.id)) {
                const foundMessage = await testerChannel.messages.cache.get(id)!.fetch(true);
                await foundMessage.reactions.removeAll();
            }

            await sleep(12 * 1000);
            await checkReactionAmount(db, 0);
        },
        timeout
    );
});
