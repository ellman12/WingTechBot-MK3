import { createReactionRepository } from "@adapters/repositories/ReactionRepository.js";
import { expect } from "vitest";

import { validEmotes } from "../../testData/reactionEmotes.js";
import { createFakeMessagesAndReactions, createTestDb } from "../../utils/testUtils.js";

describe.concurrent("getTopMessages", () => {
    const year = new Date().getUTCFullYear();
    const messages = 5;
    const reactionsPerMessage = 6;

    it("returns the correct top messages", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);

        const topMessages = await reactions.getTopMessages("101", "upvote", year);
        expect(topMessages).toHaveLength(1);
        topMessages.forEach(e => expect(e.count).toEqual(1));
    });

    it("returns empty array for year with no data", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);

        const topMessages = await reactions.getTopMessages("101", "upvote", 1969);
        expect(topMessages).toHaveLength(0);
    });
});
