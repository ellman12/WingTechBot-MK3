import { createReactionEmoteRepository } from "@adapters/repositories/ReactionEmoteRepository";
import { expect } from "vitest";

import { invalidEmotes, validEmotes } from "../../testData/reactionEmotes";
import { createTestDb } from "../../utils/testUtils";

describe.concurrent("Create ReactionEmote, valid data", () => {
    test.each(validEmotes)("%s, %s", async (name, discordId) => {
        const db = await createTestDb();
        const emotes = createReactionEmoteRepository(db);

        await emotes.create(name, discordId);
        const found = await emotes.findByNameAndDiscordId(name, discordId);
        expect(found).not.toBeNull();
    });
});

describe.concurrent("Create ReactionEmote, returns input when emote exists", () => {
    test.each(validEmotes)("%s %s", async (name, discordId) => {
        const db = await createTestDb();
        const emotes = createReactionEmoteRepository(db);

        const created = await emotes.create(name, discordId);
        const found = await emotes.findByNameAndDiscordId(name, discordId);
        expect(found).not.toBeNull();
        expect(found).toEqual(created);
    });
});

describe.concurrent("Create ReactionEmote, throws for invalid emotes", () => {
    test.each(invalidEmotes)("%s %s", async (name, discordId) => {
        const db = await createTestDb();
        const emotes = createReactionEmoteRepository(db);

        await expect(emotes.create(name, discordId)).rejects.toThrow();
    });
});
