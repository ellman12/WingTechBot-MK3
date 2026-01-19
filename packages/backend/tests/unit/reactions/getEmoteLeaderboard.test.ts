import { createBannedFeaturesRepository } from "@adapters/repositories/BannedFeaturesRepository.js";
import { createReactionRepository } from "@adapters/repositories/ReactionRepository.js";

import { validEmotes } from "../../testData/reactionEmotes.js";
import { createFakeMessagesAndReactions, createTestDb } from "../../utils/testUtils.js";

describe.concurrent("getEmoteLeaderboard", () => {
    const year = new Date().getUTCFullYear();
    const messages = 5;
    const reactionsPerMessage = 6;

    it("returns the correct leaderboard", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);

        const emotes = await reactions.getEmoteLeaderboard(year);
        expect(emotes).toHaveLength(reactionsPerMessage);
        emotes.forEach(e => expect(e.count).toEqual(messages));
    });

    it("includes self-reactions when specified", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);

        const emotes = await reactions.getEmoteLeaderboard(year, true);
        expect(emotes).toHaveLength(reactionsPerMessage);
        emotes.forEach(e => expect(e.count).toEqual(messages * 2));
    });

    it("returns empty array for year with no data", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);

        const emotes = await reactions.getEmoteLeaderboard(1969, true);
        console.log(emotes);
        expect(emotes).toHaveLength(0);
    });

    it("filters out reactions from banned users", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);
        const banned = createBannedFeaturesRepository(db);

        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);
        await banned.banFeature("301", "admin", "Reactions");

        const emotes = await reactions.getEmoteLeaderboard(year);
        expect(emotes).toHaveLength(reactionsPerMessage - 1);
        emotes.forEach(e => expect(e.count).toEqual(messages));
    });
});
