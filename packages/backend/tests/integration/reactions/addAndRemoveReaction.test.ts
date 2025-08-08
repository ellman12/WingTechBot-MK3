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
    await channel.send("Starting Add/Remove Reaction tests");
});

afterAll(async () => {
    const bot = getApp().discordBot;
    const channel = await getTestingChannel(bot);
    await channel.send("Finish Add/Remove Reaction tests");
});

beforeEach(async () => {
    await sleep(2000);

    await recreateDatabase();
});

describe("Create Messages, Add Reactions, Then Remove Them", () => {
    test.each(data)(
        "%s messages, %s reactions per message",
        async (totalMessages, reactionsPerMessage) => {
            const { channel, emotes, testerBotId, testerChannel, db } = await setUpIntegrationTest();
            await testerChannel.fetch(true);
            const messages = await createMessagesAndReactions(channel, testerChannel, totalMessages, reactionsPerMessage, emotes);

            await sleep(8 * 1000);
            await checkReactionAmount(db, totalMessages * reactionsPerMessage);

            //Remove the reactions
            for (const id of messages.map(m => m.id)) {
                const foundMessage = await testerChannel.messages.cache.get(id)!.fetch(true);

                for (let j = 0; j < reactionsPerMessage; j++) {
                    const [name, discordId] = emotes[j]!;
                    await foundMessage.reactions.cache.get(discordId ?? name)!.users.remove(testerBotId);
                }
            }

            await sleep(8 * 1000);
            await checkReactionAmount(db, 0);
        },
        timeout
    );
});
