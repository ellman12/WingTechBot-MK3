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

describe.concurrent("getReactionsGiven", () => {
    const year = new Date().getUTCFullYear();
    const messages = 5;
    const reactionsPerMessage = 6;

    it("returns the correct reactions when no receiverIds specified, ignoring banned users", async () => {
        const { db, reactions, banned } = await setUpTest();

        await banned.banFeature("bannedUser", "admin", "Reactions");
        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);
        await reactions.create({ giverId: "bannedUser", receiverId: "101", channelId: "1", messageId: "1", emoteId: 1 });

        const emotes = await reactions.getReactionsGiven("301");
        expect(emotes).toHaveLength(1);
        emotes.forEach(e => expect(e.count).toEqual(messages));
    });

    it("returns the correct reactions when receiverIds are specified, ignoring banned users", async () => {
        const { db, reactions, banned } = await setUpTest();

        await banned.banFeature("bannedUser", "admin", "Reactions");
        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);
        await reactions.create({ giverId: "bannedUser", receiverId: "101", channelId: "1", messageId: "1", emoteId: 1 });

        const emotes = await reactions.getReactionsGiven("301", year, ["101", "102", "103"]);
        expect(emotes).toHaveLength(1);

        emotes.forEach(e => {
            expect(e.count).toEqual(3);
            expect(e.name === "👀" || e.name === "downvote").toBeTruthy();
        });
    });

    it("returns self-reactions when specified for giverId, ignoring banned users", async () => {
        const { db, reactions, banned } = await setUpTest();

        await banned.banFeature("bannedUser", "admin", "Reactions");
        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);
        await reactions.create({ giverId: "bannedUser", receiverId: "101", channelId: "1", messageId: "1", emoteId: 1 });

        const emotes = await reactions.getReactionsGiven("101", year, ["101"]);
        expect(emotes).toHaveLength(reactionsPerMessage);
        emotes.forEach(e => expect(e.count).toEqual(1));
    });

    it("returns empty array for nonexistent users", async () => {
        const { db, reactions, banned } = await setUpTest();

        await banned.banFeature("bannedUser", "admin", "Reactions");
        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);
        await reactions.create({ giverId: "bannedUser", receiverId: "101", channelId: "1", messageId: "1", emoteId: 1 });

        let emotes = await reactions.getReactionsGiven("111111111111");
        expect(emotes).toHaveLength(0);

        emotes = await reactions.getReactionsGiven("111111111111", year, ["123", "456"]);
        expect(emotes).toHaveLength(0);
    });

    it("returns empty array for year with no data", async () => {
        const { db, reactions } = await setUpTest();

        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);

        let emotes = await reactions.getReactionsGiven("301", 1969);
        expect(emotes).toHaveLength(0);

        emotes = await reactions.getReactionsGiven("301", 1969, ["123", "456"]);
        expect(emotes).toHaveLength(0);
    });

    it("respects the limit parameter when specified", async () => {
        const { db, reactions, banned } = await setUpTest();

        await banned.banFeature("bannedUser", "admin", "Reactions");
        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);
        await reactions.create({ giverId: "bannedUser", receiverId: "101", channelId: "1", messageId: "1", emoteId: 1 });

        // giverId "101"'s self-reactions cover all 6 emotes; unlimited this returns reactionsPerMessage rows
        const emotes = await reactions.getReactionsGiven("101", year, ["101"], 3);
        expect(emotes).toHaveLength(3);
    });

    it("returns all results when limit exceeds the number of available results", async () => {
        const { db, reactions, banned } = await setUpTest();

        await banned.banFeature("bannedUser", "admin", "Reactions");
        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);
        await reactions.create({ giverId: "bannedUser", receiverId: "101", channelId: "1", messageId: "1", emoteId: 1 });

        // giver "301" only ever reacted with one emote (j=1), across all 5 messages, so this is always 1 row
        const emotes = await reactions.getReactionsGiven("301", year, undefined, 100);
        expect(emotes).toHaveLength(1);
    });

    it("ignores the limit when it is zero or negative", async () => {
        const { db, reactions, banned } = await setUpTest();

        await banned.banFeature("bannedUser", "admin", "Reactions");
        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);
        await reactions.create({ giverId: "bannedUser", receiverId: "101", channelId: "1", messageId: "1", emoteId: 1 });

        let emotes = await reactions.getReactionsGiven("101", year, ["101"], 0);
        expect(emotes).toHaveLength(reactionsPerMessage);

        emotes = await reactions.getReactionsGiven("101", year, ["101"], -1);
        expect(emotes).toHaveLength(reactionsPerMessage);
    });

    it("applies the limit alongside a receiverIds filter", async () => {
        const { db, reactions, banned } = await setUpTest();

        await banned.banFeature("bannedUser", "admin", "Reactions");
        await createFakeMessagesAndReactions(db, messages, reactionsPerMessage, validEmotes);
        await reactions.create({ giverId: "bannedUser", receiverId: "101", channelId: "1", messageId: "1", emoteId: 1 });

        // "999999" doesn't match anything, proving the filter is still applied alongside the limit rather than bypassed
        const emotes = await reactions.getReactionsGiven("101", year, ["101", "999999"], 3);
        expect(emotes).toHaveLength(3);
    });
});
