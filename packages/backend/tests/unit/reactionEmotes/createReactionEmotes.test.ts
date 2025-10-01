import { createReactionEmoteRepository } from "@adapters/repositories/ReactionEmoteRepository";
import { expect } from "vitest";

import { invalidEmotes, validEmotes } from "../../testData/reactionEmotes";
import { createTestDb } from "../../utils/testUtils";

describe("Create ReactionEmote, valid data", () => {
    test.each(validEmotes)("%s, %s", async (name, discordId) => {
        const db = await createTestDb();
        const emotes = createReactionEmoteRepository(db);

        await emotes.create({ name, discordId, karmaValue: 0 });
        const found = await emotes.findByNameAndDiscordId(name, discordId);
        expect(found).not.toBeNull();
    });
});

describe("Create ReactionEmote, returns input when emote exists", () => {
    test.each(validEmotes)("%s %s", async (name, discordId) => {
        const db = await createTestDb();
        const emotes = createReactionEmoteRepository(db);

        const data = { name, discordId, karmaValue: 0 };

        const created = await emotes.create(data);
        const found = await emotes.findByNameAndDiscordId(name, discordId);
        expect(found).not.toBeNull();
        expect(found).toEqual(created);
    });
});

describe("Create ReactionEmote, throws for invalid emotes", () => {
    test.each(invalidEmotes)("%s %s", async (name, discordId) => {
        const db = await createTestDb();
        const emotes = createReactionEmoteRepository(db);

        await expect(emotes.create({ name, discordId, karmaValue: 0 })).rejects.toThrow();
    });
});
