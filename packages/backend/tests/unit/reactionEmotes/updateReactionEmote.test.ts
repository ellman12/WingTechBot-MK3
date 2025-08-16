import { createReactionEmoteRepository } from "@adapters/repositories/ReactionEmoteRepository";
import { expect } from "vitest";

import { createTestDb } from "../../utils/testUtils";

describe("Update ReactionEmote", () => {
    it("Set karmaValue of ReactionEmote", async () => {
        const db = await createTestDb();
        const emotes = createReactionEmoteRepository(db);

        const original = await emotes.create({ name: "upvote", discordId: "123456", karmaValue: 0 });
        expect(original).not.toBeNull();
        expect(original.karmaValue).toEqual(0);

        const updated = await emotes.update(original.id, { karmaValue: 1 });
        expect(updated).not.toBeNull();
        expect(updated!.karmaValue).not.toEqual(original.karmaValue);
    });
});
