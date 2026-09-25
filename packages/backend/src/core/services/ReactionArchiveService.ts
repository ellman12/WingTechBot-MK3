import type { CreateMessageData } from "@core/entities/Message.js";
import type { ReactionEmoteRef } from "@core/entities/ReactionEmote.js";
import type { MessageRepository } from "@core/ports/repositories/MessageRepository.js";
import type { ReactionEmoteRepository } from "@core/ports/repositories/ReactionEmoteRepository.js";
import type { ReactionRepository } from "@core/ports/repositories/ReactionRepository.js";

//A reaction is archived together with the message it was given on, because the message may not be stored yet.
export type RecordReactionData = {
    readonly message: CreateMessageData;
    readonly giverId: string;
    readonly emote: ReactionEmoteRef;
};

export type RemoveReactionData = {
    readonly messageId: string;
    readonly channelId: string;
    readonly receiverId: string;
    readonly giverId: string;
    readonly emote: ReactionEmoteRef;
};

export type ReactionArchiveService = {
    readonly recordReaction: (data: RecordReactionData) => Promise<void>;
    readonly removeReaction: (data: RemoveReactionData) => Promise<void>;
    readonly removeReactionsForMessage: (messageId: string) => Promise<void>;
    readonly removeReactionsForEmote: (messageId: string, emote: ReactionEmoteRef) => Promise<void>;
};

export type ReactionArchiveServiceDeps = {
    messageRepository: MessageRepository;
    reactionRepository: ReactionRepository;
    emoteRepository: ReactionEmoteRepository;
};

export const createReactionArchiveService = ({ messageRepository, reactionRepository, emoteRepository }: ReactionArchiveServiceDeps): ReactionArchiveService => {
    console.log("[ReactionArchiveService] Creating reaction archive service");

    return {
        recordReaction: async ({ message, giverId, emote }): Promise<void> => {
            await messageRepository.create(message);

            const reactionEmote = await emoteRepository.create(emote.name, emote.discordId);

            await reactionRepository.create({ giverId, receiverId: message.authorId, channelId: message.channelId, messageId: message.id, emoteId: reactionEmote.id });
            console.log(`[ReactionArchiveService] ✅ Successfully saved reaction - emoji: ${emote.name}, channel: ${message.channelId}`);
        },

        removeReaction: async ({ messageId, channelId, receiverId, giverId, emote }): Promise<void> => {
            const reactionEmote = await emoteRepository.findByNameAndDiscordId(emote.name, emote.discordId);

            if (!reactionEmote) {
                console.warn("Skipping removal of reaction because reaction emote not found");
                return;
            }

            await reactionRepository.delete({ giverId, receiverId, channelId, messageId, emoteId: reactionEmote.id });
        },

        removeReactionsForMessage: async (messageId): Promise<void> => {
            await reactionRepository.deleteReactionsForMessage(messageId);
        },

        removeReactionsForEmote: async (messageId, emote): Promise<void> => {
            const found = await emoteRepository.findByNameAndDiscordId(emote.name, emote.discordId);

            if (!found) {
                throw new Error("Emote not found in removeReactionsForEmote");
            }

            await reactionRepository.deleteReactionsForEmote(messageId, found.id);
        },
    };
};
