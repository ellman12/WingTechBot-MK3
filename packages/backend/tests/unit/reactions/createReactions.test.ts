import { createMessageRepository } from "@adapters/repositories/MessageRepository";
import { createReactionEmoteRepository } from "@adapters/repositories/ReactionEmoteRepository";
import { createReactionRepository } from "@adapters/repositories/ReactionRepository";
import { expect } from "vitest";

import { invalidReactions, validReactions } from "../../testData/reactions";
import { createTestDb } from "../../utils/testUtils";

describe("Create Reaction, valid data", () => {
    test.each(validReactions)("%s, %s, %s, %s, %s, %s", async (giverId, receiverId, channelId, messageId, emoteName, emoteId) => {
        const db = await createTestDb();
        const messages = createMessageRepository(db);
        const reactions = createReactionRepository(db);
        const emotes = createReactionEmoteRepository(db);

        let emote = await emotes.findByNameAndDiscordId(emoteName, emoteId);
        expect(emote).toBeNull();

        await emotes.create({ name: emoteName, discordId: emoteId, karmaValue: 0 });
        emote = await emotes.findByNameAndDiscordId(emoteName, emoteId);
        expect(emote).not.toBeNull();

        await messages.create({ id: messageId, authorId: receiverId, channelId, content: "message lol", createdAt: new Date(), editedAt: null });
        await reactions.create({ giverId, receiverId, channelId, messageId, emoteId: emote!.id });
        const reaction = await reactions.find({ giverId, receiverId, channelId, messageId, emoteId: emote!.id });
        expect(reaction).not.toBeNull();

        const foundReactions = await reactions.findForMessage(messageId);
        expect(foundReactions).toHaveLength(1);
    });
});

describe("Create Reaction, throws for invalid reactions", () => {
    test.each(invalidReactions)("%s, %s, %s, %s, %s, %s", async (giverId, receiverId, channelId, messageId, emoteName, emoteId) => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);
        const emotes = createReactionEmoteRepository(db);

        const emote = await emotes.create({ name: emoteName, discordId: emoteId, karmaValue: 0 });
        await expect(reactions.create({ giverId, receiverId, channelId, messageId, emoteId: emote.id })).rejects.toThrow();
    });
});
