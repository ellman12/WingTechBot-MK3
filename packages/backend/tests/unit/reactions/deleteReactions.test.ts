import { createMessageRepository } from "@adapters/repositories/MessageRepository.js";
import { createReactionEmoteRepository } from "@adapters/repositories/ReactionEmoteRepository.js";
import { createReactionRepository } from "@adapters/repositories/ReactionRepository.js";

import { invalidReactions, validReactions } from "../../testData/reactions.js";
import { createTestDb } from "../../utils/testUtils.js";

describe.concurrent("Delete Reaction, reaction exists", () => {
    test.each(validReactions)("%s, %s, %s, %s, %s, %s", async (giverId, receiverId, channelId, messageId, emoteName, emoteId) => {
        const messageCount = 4;
        const db = await createTestDb();
        const messages = createMessageRepository(db);
        const reactions = createReactionRepository(db);
        const emotes = createReactionEmoteRepository(db);

        const emote = await emotes.create(emoteName, emoteId);
        expect(emote).not.toBeNull();

        const foundEmote = await emotes.findById(emote.id);
        expect(foundEmote).not.toBeNull();

        for (let i = 1; i <= messageCount; i++) {
            const msgId = messageId + i.toString();
            await messages.create({ id: msgId, authorId: receiverId, channelId, content: "message lol", createdAt: new Date(), editedAt: null });
            const reactionData = { giverId, receiverId, channelId, messageId: msgId, emoteId: emote.id };

            const reaction = await reactions.create(reactionData);
            expect(reaction).not.toBeNull();

            const foundReaction = await reactions.find(reactionData);
            expect(foundReaction).not.toBeNull();
        }

        const emoteRows = await db.selectFrom("reaction_emotes").selectAll().execute();
        expect(emoteRows.length).toEqual(1);

        const reactionRows = await db.selectFrom("reactions").selectAll().execute();
        expect(reactionRows.length).toEqual(messageCount);
    });
});

describe.concurrent("Delete Reaction, throws for nonexistent reactions", () => {
    test.each(validReactions)("%s, %s, %s, %s, %s, %s", async (giverId, receiverId, channelId, messageId) => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        let reactionRows = await db.selectFrom("reactions").selectAll().execute();
        expect(reactionRows.length).toEqual(0);

        const reactionData = { giverId, receiverId, channelId, messageId, emoteId: 1 };
        await expect(reactions.create(reactionData)).rejects.toThrow();

        reactionRows = await db.selectFrom("reactions").selectAll().execute();
        expect(reactionRows.length).toEqual(0);
    });
});

describe.concurrent("Delete Reaction, fails for invalid reactions", () => {
    test.each(invalidReactions)("%s, %s, %s, %s, %s, %s", async (giverId, receiverId, channelId, messageId) => {
        const db = await createTestDb();
        const reactions = createReactionRepository(db);

        let reactionRows = await db.selectFrom("reactions").selectAll().execute();
        expect(reactionRows.length).toEqual(0);

        const reactionData = { giverId, receiverId, channelId, messageId, emoteId: 1 };
        await expect(reactions.create(reactionData)).rejects.toThrow();

        reactionRows = await db.selectFrom("reactions").selectAll().execute();
        expect(reactionRows.length).toEqual(0);
    });
});
