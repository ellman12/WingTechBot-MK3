import { createReactionEmoteRepository } from "@adapters/repositories/ReactionEmoteRepository.js";

import { createTestDb } from "../../utils/testUtils.js";

describe.concurrent("Update ReactionEmote", () => {
    it("Set karmaValue of ReactionEmote", async () => {
        const db = await createTestDb();
        const emotes = createReactionEmoteRepository(db);

        const original = await emotes.create("upvote", "123456");
        expect(original).not.toBeNull();
        expect(original.karmaValue).toEqual(0);

        const updated = await emotes.update(original.id, { karmaValue: 1 });
        expect(updated).not.toBeNull();
        expect(updated!.karmaValue).not.toEqual(original.karmaValue);
    });
});
