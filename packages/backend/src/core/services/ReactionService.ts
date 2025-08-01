import type { ReactionEmoteRepository } from "@core/repositories/ReactionEmoteRepository";
import type { ReactionRepository } from "@core/repositories/ReactionRepository";
import type { Message, MessageReaction, OmitPartialGroupDMChannel, PartialMessage, PartialMessageReaction, PartialUser, ReadonlyCollection, User } from "discord.js";

export type ReactionService = {
    readonly addReaction: (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => Promise<void>;
    readonly removeReaction: (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => Promise<void>;
    readonly removeReactionsForMessage: (message: OmitPartialGroupDMChannel<Message<boolean> | PartialMessage>, reactions: ReadonlyCollection<string, MessageReaction>) => Promise<void>;
};

export type ReactionServiceDeps = {
    reactionRepository: ReactionRepository;
    emoteRepository: ReactionEmoteRepository;
};

export const createReactionService = ({ reactionRepository, emoteRepository }: ReactionServiceDeps): ReactionService => {
    console.log("[ReactionService] Creating reaction service");

    return {
        addReaction: async (reaction, user): Promise<void> => {
            const message = await reaction.message.fetch();
            const channel = message.channel;

            try {
                const emoteName = reaction.emoji.name;
                const emoteDiscordId = reaction.emoji.id;

                if (!emoteName) {
                    throw new Error("Missing reaction emoji name");
                }

                const reactionEmote = await emoteRepository.findOrCreate(emoteName, emoteDiscordId);

                const data = { giverId: user.id, receiverId: message.author.id, channelId: channel.id, messageId: message.id, emoteId: reactionEmote.id };
                await reactionRepository.create(data);
            } catch (e: unknown) {
                console.error("Error adding reaction to message", e);
            }
        },

        removeReaction: async (reaction, user): Promise<void> => {
            const message = await reaction.message.fetch();
            const channel = message.channel;

            try {
                const emoteName = reaction.emoji.name;
                const emoteDiscordId = reaction.emoji.id;

                if (!emoteName) {
                    throw new Error("Missing reaction emoji name");
                }

                const reactionEmote = await emoteRepository.findByNameAndDiscordId(emoteName, emoteDiscordId);

                if (!reactionEmote) {
                    console.warn("Skipping removal of reaction because reaction emote not found");
                    return;
                }

                const data = { giverId: user.id, receiverId: message.author.id, channelId: channel.id, messageId: message.id, emoteId: reactionEmote.id };
                await reactionRepository.delete(data);
            } catch (e: unknown) {
                console.error("Error removing reaction from message", e);
            }
        },

        removeReactionsForMessage: async (message): Promise<void> => {
            try {
                await reactionRepository.deleteReactionsForMessage(message.id);
            } catch (e: unknown) {
                console.error("Error removing reaction from message", e);
            }
        },
    };
};
