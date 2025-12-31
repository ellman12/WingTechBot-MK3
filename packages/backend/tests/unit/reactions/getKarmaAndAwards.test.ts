import { createReactionRepository } from "@adapters/repositories/ReactionRepository";

import { validEmotes } from "../../testData/reactionEmotes";
import { createFakeMessagesAndReactions, createTestDb } from "../../utils/testUtils";

describe.concurrent("getKarmaAndAwards", () => {
    it("returns the correct karma and awards", async () => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        await createFakeMessagesAndReactions(db, 5, 6, validEmotes);

        const emotes = await reactions.getKarmaAndAwards("101");
        expect(emotes).toHaveLength(5);

        //This should ignore self-reactions
        emotes.forEach(e => {
            if (e.name === "platinum") {
                expect(e.count).toEqual(0);
            } else {
                expect(e.count).toEqual(1);
            }
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
