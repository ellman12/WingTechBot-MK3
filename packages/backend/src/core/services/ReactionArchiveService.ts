import type { ReactionEmoteRepository } from "@core/repositories/ReactionEmoteRepository.js";
import type { ReactionRepository } from "@core/repositories/ReactionRepository.js";
import type { Message, MessageReaction, OmitPartialGroupDMChannel, PartialMessage, PartialMessageReaction, PartialUser, User } from "discord.js";

export type ReactionArchiveService = {
    readonly addReaction: (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => Promise<void>;
    readonly removeReaction: (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => Promise<void>;
    readonly removeReactionsForMessage: (message: OmitPartialGroupDMChannel<Message<boolean> | PartialMessage>) => Promise<void>;
    readonly removeReactionsForEmote: (reaction: MessageReaction | PartialMessageReaction) => Promise<void>;
};

export type ReactionArchiveServiceDeps = {
    reactionRepository: ReactionRepository;
    emoteRepository: ReactionEmoteRepository;
};

//Archives all reactions added to all messages.
export const createReactionArchiveService = ({ reactionRepository, emoteRepository }: ReactionArchiveServiceDeps): ReactionArchiveService => {
    console.log("[ReactionArchiveService] Creating reaction archive service");

    return {
        addReaction: async (reaction, user): Promise<void> => {
            const message = await reaction.message.fetch();
            const channel = message.channel;
            const year = message.createdAt.getUTCFullYear();

            if (year < new Date().getUTCFullYear()) {
                console.warn("🚫 Ignoring added reaction older than this year.");
                return;
            }

            try {
                const emoteName = reaction.emoji.name;

                if (!emoteName) {
                    throw new Error("Missing reaction emoji name");
                }

                const reactionEmote = await emoteRepository.create(emoteName, reaction.emoji.id ?? "");

                const data = { giverId: user.id, receiverId: message.author.id, channelId: channel.id, messageId: message.id, emoteId: reactionEmote.id };
                await reactionRepository.create(data);
            } catch (e: unknown) {
                console.error("Error adding reaction to message", e);
            }
        },

        removeReaction: async (reaction, user): Promise<void> => {
            const message = await reaction.message.fetch();
            const channel = message.channel;
            const year = message.createdAt.getUTCFullYear();

            if (year < new Date().getUTCFullYear()) {
                console.warn("🚫 Ignoring removed reaction older than this year.");
                return;
            }

            try {
                const emoteName = reaction.emoji.name;

                if (!emoteName) {
                    throw new Error("Missing reaction emoji name");
                }

                const reactionEmote = await emoteRepository.findByNameAndDiscordId(emoteName, reaction.emoji.id ?? "");

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
            await message.fetch();
            const year = message.createdAt.getUTCFullYear();

            if (year < new Date().getUTCFullYear()) {
                console.warn("🚫 Ignoring removed reactions from message older than this year.");
                return;
            }

            try {
                await reactionRepository.deleteReactionsForMessage(message.id);
            } catch (e: unknown) {
                console.error("Error removing reaction from message", e);
            }
        },

        removeReactionsForEmote: async (reaction): Promise<void> => {
            await reaction.fetch();
            const year = reaction.message.createdAt.getUTCFullYear();
            const name = reaction.emoji.name;

            if (year < new Date().getUTCFullYear()) {
                console.warn(`🚫 Ignoring removed reaction for emote ${name} older than this year.`);
                return;
            }

            try {
                if (!name) {
                    throw new Error("Missing emoji name in removeReactionsForEmote");
                }

                const emote = await emoteRepository.findByNameAndDiscordId(name, reaction.emoji.id ?? "");

                if (!emote) {
                    throw new Error("Emote not found in removeReactionsForEmote");
                }

                await reactionRepository.deleteReactionsForEmote(reaction.message.id, emote.id);
            } catch (e: unknown) {
                console.error("Error removing reactions for emote", e);
            }
        },
    };
};
