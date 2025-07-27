import type { ReactionEmoteRepository } from "@core/repositories/ReactionEmoteRepository";
import type { ReactionRepository } from "@core/repositories/ReactionRepository";
import type { MessageReaction, PartialMessageReaction, PartialUser, User } from "discord.js";

export type ReactionService = {
    readonly addReaction: (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => Promise<void>;
    // readonly removeReaction: () => Promise<void>;
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
    };
};
