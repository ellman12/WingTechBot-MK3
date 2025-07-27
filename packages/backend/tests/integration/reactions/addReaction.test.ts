import { getKysely } from "@infrastructure/database/DatabaseConnection";
import { beforeAll, beforeEach, describe, expect } from "vitest";

import { getApp } from "@/main";

import { getTestingChannel, getTestingEmotes, recreateDatabase, sleep } from "../../utils/testUtils";

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

    const app = getApp();
    const channel = getTestingChannel(app);
    await channel.send("Starting Add Reaction tests");
});

beforeEach(async () => {
    await sleep(2000);

    await recreateDatabase();
});

describe("Create Messages, Add Reactions to Them", () => {
    test.each(data)(
        "%s messages, %s reactions per message",
        async (messages, reactionsPerMessage) => {
            const app = getApp();
            const channel = getTestingChannel(app);
            const emotes = getTestingEmotes(app);

            const db = getKysely();

            for (let i = 0; i < messages; i++) {
                const message = await channel.send(`Add Reactions Message ${i}: ${messages} messages, ${reactionsPerMessage} reactions per message`);

                for (let j = 0; j < reactionsPerMessage; j++) {
                    const [name, discordId] = emotes[j]!;
                    await message.react(discordId ?? name);
                }
            }

            await sleep(6 * 1000);

            const reactions = await db.selectFrom("reactions").selectAll().execute();
            const expectedReactions = messages * reactionsPerMessage;
            expect(reactions.length).toStrictEqual(expectedReactions);
            expect(reactions.filter(r => r.giver_id !== process.env.DISCORD_CLIENT_ID).length).toStrictEqual(0);
        },
        timeout
    );
});
