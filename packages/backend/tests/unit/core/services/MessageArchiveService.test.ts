import type { CreateMessageData, Message } from "@core/entities/Message.js";
import type { ReactionEmote, ReactionEmoteRef } from "@core/entities/ReactionEmote.js";
import type { MessageRepository } from "@core/ports/repositories/MessageRepository.js";
import type { Repositories, UnitOfWork } from "@core/ports/repositories/UnitOfWork.js";
import { type ChannelSnapshot, createMessageArchiveService } from "@core/services/MessageArchiveService.js";
import { describe, expect, it, vi } from "vitest";

const createdAt = new Date("2024-01-01T00:00:00Z");

const upvote: ReactionEmote = { id: 1, name: "upvote", discordId: "111" as string, karmaValue: 1 };
const heart: ReactionEmote = { id: 2, name: "heart", discordId: "", karmaValue: 0 };

const storedMessage = (id: string, overrides: Partial<Message> = {}): Message => ({
    id,
    authorId: "author",
    channelId: "c1",
    content: `content ${id}`,
    referencedMessageId: undefined,
    createdAt,
    editedAt: null,
    reactions: [],
    ...overrides,
});

const snapshotMessage = (id: string, overrides: Partial<CreateMessageData> = {}): CreateMessageData => ({
    id,
    authorId: "author",
    channelId: "c1",
    content: `content ${id}`,
    referencedMessageId: undefined,
    createdAt,
    editedAt: null,
    ...overrides,
});

//Stubs the two repositories the archive touches, plus a unit of work that just hands them over.
const createService = (stored: Message[]) => {
    const messageRepository = {
        create: vi.fn(async data => ({ ...data, reactions: [] })),
        delete: vi.fn(async data => ({ ...storedMessage(data.id) })),
        edit: vi.fn(async data => ({ ...storedMessage(data.id), ...data })),
        batchCreate: vi.fn(async () => {}),
        batchUpdate: vi.fn(async () => {}),
        getMessagesForChannel: vi.fn(async () => stored),
        getAllMessages: vi.fn(async () => stored),
        getNewestMessages: vi.fn(async () => stored),
    } as unknown as MessageRepository;

    const emoteRepository = {
        batchFindOrCreate: vi.fn(async (emotes: ReactionEmoteRef[]) => new Map(emotes.map(e => [`${e.name}:${e.discordId}`, e.name === "upvote" ? upvote : heart]))),
    };

    const reactionRepository = { batchCreate: vi.fn(async () => {}), batchDelete: vi.fn(async () => {}) };

    const unitOfWork: UnitOfWork = { execute: async work => work({ messageRepository, emoteRepository, reactionRepository } as unknown as Repositories) };

    return { service: createMessageArchiveService({ unitOfWork, messageRepository }), messageRepository, reactionRepository, emoteRepository };
};

const snapshot = (overrides: Partial<ChannelSnapshot> = {}): ChannelSnapshot => ({
    channelId: "c1",
    channelName: "general",
    messages: [],
    reactions: [],
    emotes: [],
    ...overrides,
});

describe("MessageArchiveService.syncChannelSnapshot message diffing", () => {
    it("creates messages missing from the database", async () => {
        const { service, messageRepository } = createService([storedMessage("m1")]);

        const summary = await service.syncChannelSnapshot(snapshot({ messages: [snapshotMessage("m1"), snapshotMessage("m2"), snapshotMessage("m3")] }));

        expect(summary).toMatchObject({ created: 2, updated: 0, deleted: 0 });
        expect(messageRepository.batchCreate).toHaveBeenCalledWith([snapshotMessage("m2"), snapshotMessage("m3")]);
    });

    it("creates a single missing message without batching", async () => {
        const { service, messageRepository } = createService([]);

        await service.syncChannelSnapshot(snapshot({ messages: [snapshotMessage("m1")] }));

        expect(messageRepository.create).toHaveBeenCalledWith(snapshotMessage("m1"));
        expect(messageRepository.batchCreate).not.toHaveBeenCalled();
    });

    it("updates messages whose content changed", async () => {
        const { service, messageRepository } = createService([storedMessage("m1", { content: "old" })]);

        const summary = await service.syncChannelSnapshot(snapshot({ messages: [snapshotMessage("m1", { content: "new" })] }));

        expect(summary.updated).toBe(1);
        expect(messageRepository.edit).toHaveBeenCalledWith({ id: "m1", content: "new", editedAt: null });
    });

    it("updates messages that gained an editedAt timestamp", async () => {
        const editedAt = new Date("2024-02-02T00:00:00Z");
        const { service, messageRepository } = createService([storedMessage("m1")]);

        const summary = await service.syncChannelSnapshot(snapshot({ messages: [snapshotMessage("m1", { editedAt })] }));

        expect(summary.updated).toBe(1);
        expect(messageRepository.edit).toHaveBeenCalledWith({ id: "m1", content: "content m1", editedAt });
    });

    it("leaves unchanged messages alone", async () => {
        const { service, messageRepository } = createService([storedMessage("m1")]);

        const summary = await service.syncChannelSnapshot(snapshot({ messages: [snapshotMessage("m1")] }));

        expect(summary).toMatchObject({ created: 0, updated: 0, deleted: 0 });
        expect(messageRepository.create).not.toHaveBeenCalled();
        expect(messageRepository.edit).not.toHaveBeenCalled();
    });

    it("deletes stored messages that are gone from the channel", async () => {
        const { service, messageRepository } = createService([storedMessage("m1"), storedMessage("m2")]);

        const summary = await service.syncChannelSnapshot(snapshot({ messages: [snapshotMessage("m1")] }));

        expect(summary.deleted).toBe(1);
        expect(messageRepository.delete).toHaveBeenCalledWith({ id: "m2" });
    });
});

describe("MessageArchiveService.syncChannelSnapshot reaction diffing", () => {
    const reaction = { messageId: "m1", channelId: "c1", giverId: "giver", receiverId: "author", emote: { name: "upvote", discordId: "111" } };

    it("creates reactions that are not stored yet", async () => {
        const { service, reactionRepository } = createService([storedMessage("m1")]);

        const summary = await service.syncChannelSnapshot(snapshot({ messages: [snapshotMessage("m1")], reactions: [reaction], emotes: [reaction.emote] }));

        expect(summary).toMatchObject({ reactionsCreated: 1, reactionsDeleted: 0 });
        expect(reactionRepository.batchCreate).toHaveBeenCalledWith([{ giverId: "giver", receiverId: "author", channelId: "c1", messageId: "m1", emoteId: 1 }]);
    });

    it("deletes stored reactions that no longer exist", async () => {
        const stored = storedMessage("m1", { reactions: [{ giverId: "giver", receiverId: "author", channelId: "c1", messageId: "m1", emoteId: 1 }] });
        const { service, reactionRepository } = createService([stored]);

        const summary = await service.syncChannelSnapshot(snapshot({ messages: [snapshotMessage("m1")] }));

        expect(summary).toMatchObject({ reactionsCreated: 0, reactionsDeleted: 1 });
        expect(reactionRepository.batchDelete).toHaveBeenCalledWith([{ giverId: "giver", receiverId: "author", channelId: "c1", messageId: "m1", emoteId: 1 }]);
    });

    it("does nothing for reactions that already match", async () => {
        const stored = storedMessage("m1", { reactions: [{ giverId: "giver", receiverId: "author", channelId: "c1", messageId: "m1", emoteId: 1 }] });
        const { service, reactionRepository } = createService([stored]);

        const summary = await service.syncChannelSnapshot(snapshot({ messages: [snapshotMessage("m1")], reactions: [reaction], emotes: [reaction.emote] }));

        expect(summary).toMatchObject({ reactionsCreated: 0, reactionsDeleted: 0 });
        expect(reactionRepository.batchCreate).not.toHaveBeenCalled();
        expect(reactionRepository.batchDelete).not.toHaveBeenCalled();
    });

    it("throws when a reaction references an emote that was not created", async () => {
        const { service } = createService([storedMessage("m1")]);

        await expect(service.syncChannelSnapshot(snapshot({ messages: [snapshotMessage("m1")], reactions: [reaction], emotes: [] }))).rejects.toThrow("Emote not found in cache: upvote:111");
    });

    it("skips the emote round trip when the snapshot has no emotes", async () => {
        const { service, emoteRepository } = createService([]);

        await service.syncChannelSnapshot(snapshot());

        expect(emoteRepository.batchFindOrCreate).not.toHaveBeenCalled();
    });
});

describe("MessageArchiveService single message operations", () => {
    it("archives a message", async () => {
        const { service, messageRepository } = createService([]);

        await service.archiveMessage(snapshotMessage("m1"));

        expect(messageRepository.create).toHaveBeenCalledWith(snapshotMessage("m1"));
    });

    it("swallows archive failures", async () => {
        const { service, messageRepository } = createService([]);
        vi.mocked(messageRepository.create).mockRejectedValueOnce(new Error("db down"));

        await expect(service.archiveMessage(snapshotMessage("m1"))).resolves.toBeUndefined();
    });

    it("ignores deletions of messages that were never stored", async () => {
        const { service, messageRepository } = createService([]);
        vi.mocked(messageRepository.delete).mockRejectedValueOnce(new Error("Message does not exist"));

        await expect(service.deleteMessage("m1")).resolves.toBeUndefined();
    });

    it("edits a message", async () => {
        const { service, messageRepository } = createService([]);

        await service.editMessage({ id: "m1", content: "new", editedAt: null });

        expect(messageRepository.edit).toHaveBeenCalledWith({ id: "m1", content: "new", editedAt: null });
    });
});

describe("MessageArchiveService queries", () => {
    it("reports whether any message exists", async () => {
        const { service: empty } = createService([]);
        expect(await empty.hasAnyMessages()).toBe(false);

        const { service: filled } = createService([storedMessage("m1")]);
        expect(await filled.hasAnyMessages()).toBe(true);
    });

    it("asks the repository for the newest messages of a channel", async () => {
        const { service, messageRepository } = createService([storedMessage("m1")]);

        await service.getNewestMessages("c1", 10, 30);

        expect(messageRepository.getNewestMessages).toHaveBeenCalledWith(10, "c1", 30);
    });

    it("returns an empty list when the repository fails", async () => {
        const { service, messageRepository } = createService([]);
        vi.mocked(messageRepository.getAllMessages).mockRejectedValueOnce(new Error("db down"));

        expect(await service.getAllMessages(2024)).toEqual([]);
    });
});
