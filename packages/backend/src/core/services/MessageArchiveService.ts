import type { CreateMessageData, EditMessageData, Message } from "@core/entities/Message.js";
import type { CreateReactionData } from "@core/entities/Reaction.js";
import type { ReactionEmoteRef } from "@core/entities/ReactionEmote.js";
import type { MessageRepository } from "@core/ports/repositories/MessageRepository.js";
import type { UnitOfWork } from "@core/ports/repositories/UnitOfWork.js";
import { executeBatchWithAdaptiveSize } from "@core/utils/batchUtils.js";

//One reaction seen on a channel snapshot, before its emote has been resolved to a database id.
export type ChannelSnapshotReaction = {
    readonly messageId: string;
    readonly channelId: string;
    readonly giverId: string;
    readonly receiverId: string;
    readonly emote: ReactionEmoteRef;
};

//Everything that currently exists in a channel, as plain data. The database is reconciled to match it.
export type ChannelSnapshot = {
    readonly channelId: string;
    readonly channelName: string;
    readonly endYear?: number;
    readonly messages: CreateMessageData[];
    readonly reactions: ChannelSnapshotReaction[];
    readonly emotes: ReactionEmoteRef[];
};

export type ChannelSnapshotSummary = {
    readonly created: number;
    readonly updated: number;
    readonly deleted: number;
    readonly reactionsCreated: number;
    readonly reactionsDeleted: number;
};

export type MessageArchiveService = {
    readonly archiveMessage: (data: CreateMessageData) => Promise<void>;

    readonly deleteMessage: (id: string) => Promise<void>;

    readonly editMessage: (data: EditMessageData) => Promise<void>;

    readonly syncChannelSnapshot: (snapshot: ChannelSnapshot) => Promise<ChannelSnapshotSummary>;

    readonly getAllMessages: (year?: number) => Promise<Message[]>;

    readonly getNewestMessages: (channelId: string, limit: number, withinMinutes?: number) => Promise<Message[]>;

    readonly hasAnyMessages: () => Promise<boolean>;
};

export type MessageArchiveServiceDeps = {
    unitOfWork: UnitOfWork;
    messageRepository: MessageRepository;
};

type MessageUpdate = { id: string; content: string; editedAt: Date | null };

const reactionKey = (r: CreateReactionData) => `${r.giverId}:${r.receiverId}:${r.channelId}:${r.messageId}:${r.emoteId}`;

//Splits the snapshot's messages into the ones missing from the database and the ones whose content or edit time changed.
const diffMessages = (snapshotMessages: CreateMessageData[], existing: Map<string, Message>): { messagesToCreate: CreateMessageData[]; messagesToUpdate: MessageUpdate[] } => {
    return snapshotMessages.reduce<{ messagesToCreate: CreateMessageData[]; messagesToUpdate: MessageUpdate[] }>(
        (acc, message) => {
            const existingMsg = existing.get(message.id);

            if (!existingMsg) {
                return { ...acc, messagesToCreate: [...acc.messagesToCreate, message] };
            }

            const contentChanged = existingMsg.content !== message.content;
            const editedAtChanged = (existingMsg.editedAt === null && message.editedAt !== null) || (existingMsg.editedAt !== null && message.editedAt !== null && existingMsg.editedAt.getTime() !== message.editedAt.getTime());

            if (contentChanged || editedAtChanged) {
                return { ...acc, messagesToUpdate: [...acc.messagesToUpdate, { id: message.id, content: message.content, editedAt: message.editedAt }] };
            }

            return acc;
        },
        { messagesToCreate: [], messagesToUpdate: [] }
    );
};

//Set difference between the reactions the snapshot says exist and the ones already stored.
const diffReactions = (target: CreateReactionData[], existing: CreateReactionData[]): { reactionsToAdd: CreateReactionData[]; reactionsToRemove: CreateReactionData[] } => {
    const targetSet = new Set(target.map(reactionKey));
    const existingSet = new Set(existing.map(reactionKey));

    return {
        reactionsToAdd: target.filter(r => !existingSet.has(reactionKey(r))),
        reactionsToRemove: existing.filter(r => !targetSet.has(reactionKey(r))),
    };
};

export const createMessageArchiveService = ({ unitOfWork, messageRepository }: MessageArchiveServiceDeps): MessageArchiveService => {
    console.log("[MessageArchiveService] Creating message archive service");

    //Creates (or finds) every emote in the snapshot and resolves the snapshot's reactions to database reaction rows.
    async function resolveReactions(snapshot: ChannelSnapshot): Promise<CreateReactionData[]> {
        const emoteCache = snapshot.emotes.length > 0 ? await unitOfWork.execute(async repos => repos.emoteRepository.batchFindOrCreate(snapshot.emotes)) : new Map<string, { id: number }>();

        return snapshot.reactions.map(r => {
            const emoteKey = `${r.emote.name}:${r.emote.discordId}`;
            const emote = emoteCache.get(emoteKey);
            if (!emote) {
                throw new Error(`Emote not found in cache: ${emoteKey}`);
            }

            return { giverId: r.giverId, receiverId: r.receiverId, channelId: r.channelId, messageId: r.messageId, emoteId: emote.id };
        });
    }

    async function applyMessageChanges(channelName: string, messagesToCreate: CreateMessageData[], messagesToUpdate: MessageUpdate[], messagesToDelete: string[]): Promise<void> {
        //Delete messages first (this will cascade delete reactions)
        if (messagesToDelete.length > 0) {
            await Promise.all(messagesToDelete.map(id => messageRepository.delete({ id })));
            console.log(`🗑️ Deleted ${messagesToDelete.length} messages from #${channelName}`);
        }

        //Create messages: 7 params (id, authorId, channelId, content, referencedMessageId, createdAt, editedAt)
        await executeBatchWithAdaptiveSize(
            messagesToCreate,
            async batch => {
                if (batch.length === 1) {
                    await messageRepository.create(batch[0]!);
                } else if (batch.length > 1) {
                    await messageRepository.batchCreate(batch);
                }
            },
            `Create Messages (#${channelName})`,
            7
        );

        //Update messages: 3 params (id, content, editedAt)
        await executeBatchWithAdaptiveSize(
            messagesToUpdate,
            async batch => {
                if (batch.length === 1) {
                    await messageRepository.edit({ id: batch[0]!.id, content: batch[0]!.content, editedAt: batch[0]!.editedAt });
                } else if (batch.length > 1) {
                    await messageRepository.batchUpdate(batch);
                }
            },
            `Update Messages (#${channelName})`,
            3
        );
    }

    async function applyReactionChanges(channelName: string, reactionsToAdd: CreateReactionData[], reactionsToRemove: CreateReactionData[]): Promise<void> {
        //Delete reactions: 5 params (giverId, receiverId, channelId, messageId, emoteId)
        await executeBatchWithAdaptiveSize(
            reactionsToRemove,
            async batch => {
                await unitOfWork.execute(async repos => {
                    await repos.reactionRepository.batchDelete(batch);
                });
            },
            `Delete Reactions (#${channelName})`,
            5
        );

        //Create reactions: 5 params (giverId, receiverId, channelId, messageId, emoteId)
        await executeBatchWithAdaptiveSize(
            reactionsToAdd,
            async batch => {
                await unitOfWork.execute(async repos => {
                    await repos.reactionRepository.batchCreate(batch);
                });
            },
            `Create Reactions (#${channelName})`,
            5
        );
    }

    //Reconciles the database with everything a channel currently contains: creates, updates, deletions, and reactions.
    async function syncChannelSnapshot(snapshot: ChannelSnapshot): Promise<ChannelSnapshotSummary> {
        const { channelId, channelName, endYear } = snapshot;

        const existingMessagesArray = await messageRepository.getMessagesForChannel(channelId, endYear);
        const existingMessages = new Map(existingMessagesArray.map(m => [m.id, m]));

        const snapshotMessageIds = new Set(snapshot.messages.map(m => m.id));
        const messagesToDelete = existingMessagesArray.filter(m => !snapshotMessageIds.has(m.id)).map(m => m.id);

        const targetReactions = await resolveReactions(snapshot);

        const { messagesToCreate, messagesToUpdate } = diffMessages(snapshot.messages, existingMessages);
        const existingReactions = [...existingMessages.values()].flatMap(m => m.reactions);
        const { reactionsToAdd, reactionsToRemove } = diffReactions(targetReactions, existingReactions);

        await applyMessageChanges(channelName, messagesToCreate, messagesToUpdate, messagesToDelete);
        await applyReactionChanges(channelName, reactionsToAdd, reactionsToRemove);

        return {
            created: messagesToCreate.length,
            updated: messagesToUpdate.length,
            deleted: messagesToDelete.length,
            reactionsCreated: reactionsToAdd.length,
            reactionsDeleted: reactionsToRemove.length,
        };
    }

    async function archiveMessage(data: CreateMessageData): Promise<void> {
        try {
            await messageRepository.create(data);
        } catch (e: unknown) {
            console.error("Error adding message to database", e, data.content);
        }
    }

    async function deleteMessage(id: string): Promise<void> {
        try {
            await messageRepository.delete({ id });
        } catch (e: unknown) {
            if (e instanceof Error && e.message === "Message does not exist") {
                return;
            }
            console.error("Error removing message from database", e, id);
        }
    }

    async function editMessage(data: EditMessageData): Promise<void> {
        try {
            await messageRepository.edit(data);
        } catch (e: unknown) {
            console.error("Error updating content of message", e, data.content);
        }
    }

    async function getAllMessages(year?: number): Promise<Message[]> {
        try {
            return await messageRepository.getAllMessages(year);
        } catch (e: unknown) {
            console.error("Error getting all DB messages", e);
        }

        return [];
    }

    async function getNewestMessages(channelId: string, limit: number, withinMinutes?: number): Promise<Message[]> {
        try {
            return await messageRepository.getNewestMessages(limit, channelId, withinMinutes);
        } catch (e: unknown) {
            console.error("Error getting newest DB messages", e);
        }

        return [];
    }

    async function hasAnyMessages(): Promise<boolean> {
        try {
            const messages = await messageRepository.getNewestMessages(1);
            return messages.length > 0;
        } catch (e: unknown) {
            console.error("Error checking if any messages exist", e);
            return false;
        }
    }

    return {
        archiveMessage,
        deleteMessage,
        editMessage,
        syncChannelSnapshot,
        getAllMessages,
        getNewestMessages,
        hasAnyMessages,
    };
};
