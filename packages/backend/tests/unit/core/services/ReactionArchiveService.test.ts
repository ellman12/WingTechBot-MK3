import type { CreateMessageData } from "@core/entities/Message.js";
import type { ReactionEmote } from "@core/entities/ReactionEmote.js";
import type { MessageRepository } from "@core/ports/repositories/MessageRepository.js";
import type { ReactionEmoteRepository } from "@core/ports/repositories/ReactionEmoteRepository.js";
import type { ReactionRepository } from "@core/ports/repositories/ReactionRepository.js";
import { createReactionArchiveService } from "@core/services/ReactionArchiveService.js";
import { describe, expect, it, vi } from "vitest";

const upvote: ReactionEmote = { id: 7, name: "upvote", discordId: "111", karmaValue: 1 };

const message: CreateMessageData = {
    id: "m1",
    authorId: "author",
    channelId: "c1",
    content: "hello",
    referencedMessageId: undefined,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    editedAt: null,
};

const createService = (emote: ReactionEmote | null = upvote) => {
    const messageRepository = { create: vi.fn(async () => ({ ...message, reactions: [] })) } as unknown as MessageRepository;

    const reactionRepository = {
        create: vi.fn(async data => data),
        delete: vi.fn(async () => {}),
        deleteReactionsForMessage: vi.fn(async () => {}),
        deleteReactionsForEmote: vi.fn(async () => {}),
    } as unknown as ReactionRepository;

    const emoteRepository = {
        create: vi.fn(async () => upvote),
        findByNameAndDiscordId: vi.fn(async () => emote),
    } as unknown as ReactionEmoteRepository;

    return { service: createReactionArchiveService({ messageRepository, reactionRepository, emoteRepository }), messageRepository, reactionRepository, emoteRepository };
};

describe("ReactionArchiveService.recordReaction", () => {
    it("archives the message, the emote, and the reaction", async () => {
        const { service, messageRepository, reactionRepository, emoteRepository } = createService();

        await service.recordReaction({ message, giverId: "giver", emote: { name: "upvote", discordId: "111" } });

        expect(messageRepository.create).toHaveBeenCalledWith(message);
        expect(emoteRepository.create).toHaveBeenCalledWith("upvote", "111");
        expect(reactionRepository.create).toHaveBeenCalledWith({ giverId: "giver", receiverId: "author", channelId: "c1", messageId: "m1", emoteId: 7 });
    });

    it("propagates repository failures so the caller can decide what to do", async () => {
        const { service, messageRepository } = createService();
        vi.mocked(messageRepository.create).mockRejectedValueOnce(new Error("db down"));

        await expect(service.recordReaction({ message, giverId: "giver", emote: { name: "upvote", discordId: "111" } })).rejects.toThrow("db down");
    });
});

describe("ReactionArchiveService.removeReaction", () => {
    it("deletes the reaction for the resolved emote", async () => {
        const { service, reactionRepository } = createService();

        await service.removeReaction({ messageId: "m1", channelId: "c1", receiverId: "author", giverId: "giver", emote: { name: "upvote", discordId: "111" } });

        expect(reactionRepository.delete).toHaveBeenCalledWith({ giverId: "giver", receiverId: "author", channelId: "c1", messageId: "m1", emoteId: 7 });
    });

    it("skips deletion when the emote is unknown", async () => {
        const { service, reactionRepository } = createService(null);

        await service.removeReaction({ messageId: "m1", channelId: "c1", receiverId: "author", giverId: "giver", emote: { name: "upvote", discordId: "111" } });

        expect(reactionRepository.delete).not.toHaveBeenCalled();
    });
});

describe("ReactionArchiveService bulk removal", () => {
    it("removes every reaction on a message", async () => {
        const { service, reactionRepository } = createService();

        await service.removeReactionsForMessage("m1");

        expect(reactionRepository.deleteReactionsForMessage).toHaveBeenCalledWith("m1");
    });

    it("removes every reaction of one emote on a message", async () => {
        const { service, reactionRepository } = createService();

        await service.removeReactionsForEmote("m1", { name: "upvote", discordId: "111" });

        expect(reactionRepository.deleteReactionsForEmote).toHaveBeenCalledWith("m1", 7);
    });

    it("throws when the emote to remove is unknown", async () => {
        const { service } = createService(null);

        await expect(service.removeReactionsForEmote("m1", { name: "upvote", discordId: "111" })).rejects.toThrow("Emote not found in removeReactionsForEmote");
    });
});
