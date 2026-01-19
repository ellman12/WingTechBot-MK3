import { createBannedFeaturesRepository } from "@adapters/repositories/BannedFeaturesRepository.js";
import { createReactionRepository } from "@adapters/repositories/ReactionRepository.js";

import { validEmotes } from "../../testData/reactionEmotes.js";
import { createFakeMessagesAndReactions, createTestDb } from "../../utils/testUtils.js";

describe.concurrent("getKarmaAndAwards", () => {
    it("returns the correct karma and awards, ignoring banned users", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);
        const banned = createBannedFeaturesRepository(db);

        await banned.banFeature("bannedUser", "admin", "Reactions");
        await createFakeMessagesAndReactions(db, 5, 6, validEmotes);
        await reactions.create({ giverId: "bannedUser", receiverId: "101", channelId: "1", messageId: "1", emoteId: 1 });

        const emotes = await reactions.getKarmaAndAwards("101");
        expect(emotes).toHaveLength(5);

        emotes.forEach(e => {
            if (e.name === "platinum") expect(e.count).toEqual(0);
            else expect(e.count).toEqual(1);
        });
    });

    it("returns default data for nonexistent users", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        await createFakeMessagesAndReactions(db, 5, 6, validEmotes);

        const emotes = await reactions.getKarmaAndAwards("111111111111");
        expect(emotes).toHaveLength(5);
        emotes.forEach(e => expect(e.count).toEqual(0));
    });
});
