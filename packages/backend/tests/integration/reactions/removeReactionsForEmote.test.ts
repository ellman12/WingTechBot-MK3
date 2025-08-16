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
    await channel.send("Starting Remove Reactions for Emote tests");
});

afterAll(async () => {
    const bot = getApp().discordBot;
    const channel = await getTestingChannel(bot);
    await channel.send("Finish Remove Reactions for Emote tests");
});

beforeEach(async () => {
    await sleep(2000);

    await recreateDatabase();
});

describe("Remove Reactions for Emote", () => {
    test.each(data)(
        "%s messages, %s reactions per message",
        async (totalMessages, reactionsPerMessage) => {
            const { channel, emotes, testerChannel, db } = await setUpIntegrationTest();
            await testerChannel.fetch(true);
            const messages = await createMessagesAndReactions(channel, testerChannel, totalMessages, reactionsPerMessage, emotes);

            await sleep(12 * 1000);
            await checkReactionAmount(db, totalMessages * reactionsPerMessage);

            for (const message of messages) {
                for (let j = 0; j < reactionsPerMessage; j++) {
                    const [name, discordId] = emotes[j]!;
                    const reaction = message.reactions.cache.find(r => r.emoji.name === name && r.emoji.id === discordId)!;
                    await reaction.remove();
                }
            }

            await sleep(12 * 1000);
            await checkReactionAmount(db, 0);
        },
        timeout
    );
});
