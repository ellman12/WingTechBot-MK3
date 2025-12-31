import { createReactionRepository } from "@adapters/repositories/ReactionRepository";
import { expect } from "vitest";

import { createTestDb, createTestReactions } from "../../utils/testUtils";

type MessageTestData = [number, number];

const data: MessageTestData[] = [
    [1, 1],
    [2, 1],
    [1, 2],
    [2, 2],
    [3, 2],
    [1, 3],
    [4, 1],
];

describe.concurrent("Delete Reactions for Emote, valid data", () => {
    test.each(data)("%s %s", async (messageCount, reactionsPerMessage) => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        await createTestReactions(db, messageCount, reactionsPerMessage, "100");

        await reactions.deleteReactionsForEmote("1000", 1);

        const expectedRemainingReactions = messageCount * reactionsPerMessage - 1;
        const remainingReactions = await db.selectFrom("reactions").selectAll().execute();
        expect(remainingReactions.length).toEqual(expectedRemainingReactions);
        expect(remainingReactions.filter(r => r.message_id === "1000" && r.emote_id === 1).length).toEqual(0);
    });
});

describe.concurrent("Delete Reactions for Emote, throws for nonexistent reactions", () => {
    test.each(data)("%s %s", async (messageCount, reactionsPerMessage) => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        await createTestReactions(db, messageCount, reactionsPerMessage, "100");

        await expect(reactions.deleteReactionsForEmote("69", 420)).rejects.toThrow();
    });
});
