import { createReactionRepository } from "@adapters/repositories/ReactionRepository";
import { expect } from "vitest";

import { validEmotes } from "../../testData/reactionEmotes";
import { createFakeMessagesAndReactions, createTestDb } from "../../utils/testUtils";

describe("getReactionsGiven", () => {
    const year = new Date().getUTCFullYear();
    const messages = 5;
    const reactionsPerMessage = 6;

    it("returns the correct reactions when no receiverIds specified", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);

        const emotes = await reactions.getReactionsGiven("301");
        expect(emotes).toHaveLength(1);
        emotes.forEach(e => expect(e.count).toEqual(messages));
    });

    it("returns the correct reactions when receiverIds are specified", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);

        const emotes = await reactions.getReactionsGiven("301", year, ["101", "102", "103"]);
        expect(emotes).toHaveLength(1);
        emotes.forEach(e => {
            expect(e.count).toEqual(3);
            expect(e.name === "👀" || e.name === "downvote").toBeTruthy();
        });
    });

    it("returns self-reactions when specified for giverId", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);

        const emotes = await reactions.getReactionsGiven("101", year, ["101"]);
        expect(emotes).toHaveLength(reactionsPerMessage);
        emotes.forEach(e => expect(e.count).toEqual(1));
    });

    it("returns empty array for nonexistent users", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);

        let emotes = await reactions.getReactionsGiven("111111111111");
        expect(emotes).toHaveLength(0);

        emotes = await reactions.getReactionsGiven("111111111111", year, ["123", "456"]);
        expect(emotes).toHaveLength(0);
    });
});
