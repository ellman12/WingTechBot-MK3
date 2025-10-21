import { createReactionRepository } from "@adapters/repositories/ReactionRepository";
import { expect } from "vitest";

import { validEmotes } from "../../testData/reactionEmotes";
import { createFakeMessagesAndReactions, createTestDb } from "../../utils/testUtils";

describe("getReactionsReceived", () => {
    const year = new Date().getUTCFullYear();
    const messages = 5;
    const reactionsPerMessage = 6;

    it("returns the correct reactions when no giverIds specified", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);

        const emotes = await reactions.getReactionsReceived("101");
        expect(emotes.size).toEqual(reactionsPerMessage);
        emotes.forEach(e => expect(e.count).toEqual(1));
    });

    it("returns the correct reactions when giverIds are specified", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);

        const emotes = await reactions.getReactionsReceived("101", year, ["301", "302"]);
        expect(emotes.size).toEqual(2);
        emotes.forEach(e => {
            expect(e.count).toEqual(1);
            expect(e.name === "👀" || e.name === "downvote").toBeTruthy();
        });
    });

    it("returns self-reactions when specified for giverId", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);

        const emotes = await reactions.getReactionsReceived("101", year, ["101"]);
        expect(emotes.size).toEqual(reactionsPerMessage);
        emotes.forEach(e => expect(e.count).toEqual(1));
    });

    it("returns empty array for nonexistent users", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);

        let emotes = await reactions.getReactionsReceived("111111111111");
        expect(emotes).toHaveLength(0);

        emotes = await reactions.getReactionsReceived("111111111111", year, ["123", "456"]);
        expect(emotes).toHaveLength(0);
    });
});
