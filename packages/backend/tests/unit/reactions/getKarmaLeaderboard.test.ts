import { createReactionRepository } from "@adapters/repositories/ReactionRepository.js";
import { expect } from "vitest";

import { validEmotes } from "../../testData/reactionEmotes.js";
import { createFakeMessagesAndReactions, createTestDb } from "../../utils/testUtils.js";

describe.concurrent("getKarmaLeaderboard", () => {
    const year = new Date().getUTCFullYear();
    const messages = 5;
    const reactionsPerMessage = 6;

    it("returns the correct leaderboard", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);

        const leaderboard = await reactions.getKarmaLeaderboard(year);
        expect(leaderboard).toHaveLength(messages);
        leaderboard.forEach(e => expect(e.totalKarma).toEqual(1));
    });

    it("includes self-reactions when specified", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);

        const leaderboard = await reactions.getKarmaLeaderboard(year, true);
        expect(leaderboard).toHaveLength(messages);
        leaderboard.forEach(e => expect(e.totalKarma).toEqual(2));
    });

    it("returns empty array for year with no data", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);

        const leaderboard = await reactions.getKarmaLeaderboard(1969, true);
        expect(leaderboard).toHaveLength(0);
    });
});
