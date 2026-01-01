import { createReactionRepository } from "@adapters/repositories/ReactionRepository.js";
import { expect } from "vitest";

import { createTestDb, createTestReactions } from "../../utils/testUtils.js";

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

describe.concurrent("Delete Reactions for Message, valid data", () => {
    test.each(data)("%s %s", async (messageCount, reactionsPerMessage) => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        await createTestReactions(db, messageCount, reactionsPerMessage, "100");

        await reactions.deleteReactionsForMessage("1000");

        const expectedRemainingReactions = messageCount * reactionsPerMessage - reactionsPerMessage;
        const remainingReactions = await db.selectFrom("reactions").selectAll().execute();
        expect(remainingReactions.length).toEqual(expectedRemainingReactions);
        expect(remainingReactions.filter(r => r.message_id === "1000").length).toEqual(0);
    });
});

describe.concurrent("Delete Reactions for Message, throws for nonexistent reactions", () => {
    test.each(data)("%s %s", async (messageCount, reactionsPerMessage) => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        await createTestReactions(db, messageCount, reactionsPerMessage, "100");

        await expect(reactions.deleteReactionsForMessage("69")).rejects.toThrow();
    });
});
