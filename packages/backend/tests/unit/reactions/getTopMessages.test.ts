import { createBannedFeaturesRepository } from "@adapters/repositories/BannedFeaturesRepository.js";
import { createReactionRepository } from "@adapters/repositories/ReactionRepository.js";

import { validEmotes } from "../../testData/reactionEmotes.js";
import { createFakeMessagesAndReactions, createTestDb } from "../../utils/testUtils.js";

const setUpTest = async () => {
    const db = await createTestDb();
    const reactions = createReactionRepository(db);
    const banned = createBannedFeaturesRepository(db);
    return { db, reactions, banned };
};

describe.concurrent("getTopMessages", () => {
    const year = new Date().getUTCFullYear();
    const messages = 5;
    const reactionsPerMessage = 6;

    it("returns the correct top messages for a specific emote", async () => {
        const { db, reactions, banned } = await setUpTest();

        await banned.banFeature("bannedUser", "admin", "Reactions");
        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);
        await reactions.create({ giverId: "bannedUser", receiverId: "101", channelId: "1", messageId: "1", emoteId: 1 });

        const topMessages = await reactions.getTopMessages("101", "upvote", year);
        expect(topMessages).toHaveLength(1);
        topMessages.forEach(e => {
            expect(e.count).toEqual(1);
            expect(e.emoteName).toEqual("upvote");
            expect(e.emoteId).not.toBeUndefined();
        });
    });

    it("returns empty array for year with no data", async () => {
        const { db, reactions, banned } = await setUpTest();

        await banned.banFeature("bannedUser", "admin", "Reactions");
        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);
        await reactions.create({ giverId: "bannedUser", receiverId: "101", channelId: "1", messageId: "1", emoteId: 1 });

        const topMessages = await reactions.getTopMessages("101", "upvote", 1969);
        expect(topMessages).toHaveLength(0);
    });

    it("counts all reactions per message when emoteName is omitted", async () => {
        const { db, reactions, banned } = await setUpTest();

        await banned.banFeature("bannedUser", "admin", "Reactions");
        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);
        await reactions.create({ giverId: "bannedUser", receiverId: "101", channelId: "1", messageId: "1", emoteId: 1 });

        const perEmoteMessages = await reactions.getTopMessages("101", "upvote", year);
        const allEmoteMessages = await reactions.getTopMessages("101", undefined, year);

        expect(allEmoteMessages.length).toBeGreaterThan(0);
        allEmoteMessages.forEach(e => {
            expect(e.emoteName).toBeUndefined();
            expect(e.emoteId).toBeUndefined();
        });

        //Combined total across all emotes for a message should be at least as big as any single emote total
        const combinedTotal = allEmoteMessages.reduce((sum, e) => sum + e.count, 0);
        const singleEmoteTotal = perEmoteMessages.reduce((sum, e) => sum + e.count, 0);
        expect(combinedTotal).toBeGreaterThanOrEqual(singleEmoteTotal);
    });

    it("respects the limit when emoteName is omitted", async () => {
        const { db, reactions } = await setUpTest();

        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);

        const topMessages = await reactions.getTopMessages("101", undefined, year, 2);
        expect(topMessages.length).toBeLessThanOrEqual(2);
    });
});
