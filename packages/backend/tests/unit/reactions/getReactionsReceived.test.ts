import { createBannedFeaturesRepository } from "@adapters/repositories/BannedFeaturesRepository.js";
import { createReactionRepository } from "@adapters/repositories/ReactionRepository.js";

import { validEmotes } from "../../testData/reactionEmotes.js";
import { createFakeMessagesAndReactions, createTestDb } from "../../utils/testUtils.js";

describe.concurrent("getReactionsReceived", () => {
    const year = new Date().getUTCFullYear();
    const messages = 5;
    const reactionsPerMessage = 6;

    it("returns the correct reactions when no giverIds specified, ignoring banned users", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);
        const banned = createBannedFeaturesRepository(db);

        await banned.banFeature("bannedUser", "admin", "Reactions");
        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);
        await reactions.create({ giverId: "bannedUser", receiverId: "101", channelId: "1", messageId: "1", emoteId: 1 });

        const emotes = await reactions.getReactionsReceived("101");
        expect(emotes).toHaveLength(reactionsPerMessage);

        // Banned user's reactions ignored
        emotes.forEach(e => expect(e.count).toEqual(1));
    });

    it("returns the correct reactions when giverIds are specified, ignoring banned users", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);
        const banned = createBannedFeaturesRepository(db);

        await banned.banFeature("bannedUser", "admin", "Reactions");
        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);
        await reactions.create({ giverId: "bannedUser", receiverId: "101", channelId: "1", messageId: "1", emoteId: 1 });

        const emotes = await reactions.getReactionsReceived("101", year, ["301", "302"]);
        expect(emotes).toHaveLength(2);

        emotes.forEach(e => {
            expect(e.count).toEqual(1);
            expect(e.name === "👀" || e.name === "downvote").toBeTruthy();
        });
    });

    it("returns self-reactions when specified for giverId, ignoring banned users", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);
        const banned = createBannedFeaturesRepository(db);

        await banned.banFeature("bannedUser", "admin", "Reactions");
        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);
        await reactions.create({ giverId: "bannedUser", receiverId: "101", channelId: "1", messageId: "1", emoteId: 1 });

        const emotes = await reactions.getReactionsReceived("101", year, ["101"]);
        expect(emotes).toHaveLength(reactionsPerMessage);

        emotes.forEach(e => expect(e.count).toEqual(1));
    });

    it("returns empty array for nonexistent users", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);
        const banned = createBannedFeaturesRepository(db);

        await banned.banFeature("bannedUser", "admin", "Reactions");
        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);
        await reactions.create({ giverId: "bannedUser", receiverId: "101", channelId: "1", messageId: "1", emoteId: 1 });

        let emotes = await reactions.getReactionsReceived("111111111111");
        expect(emotes).toHaveLength(0);

        emotes = await reactions.getReactionsReceived("111111111111", year, ["123", "456"]);
        expect(emotes).toHaveLength(0);
    });

    it("returns empty array for year with no data", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);
        const banned = createBannedFeaturesRepository(db);

        await banned.banFeature("bannedUser", "admin", "Reactions");
        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);
        await reactions.create({ giverId: "bannedUser", receiverId: "101", channelId: "1", messageId: "1", emoteId: 1 });

        let emotes = await reactions.getReactionsReceived("101", 1969);
        expect(emotes).toHaveLength(0);

        emotes = await reactions.getReactionsReceived("101", 1969, ["123", "456"]);
        expect(emotes).toHaveLength(0);
    });
});
