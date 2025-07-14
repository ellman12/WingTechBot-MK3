import type { ReactionEmoteRepository } from "@core/repositories/ReactionEmoteRepository";
import type { ReactionRepository } from "@core/repositories/ReactionRepository";
import { type Client, Events, MessageReaction, type PartialMessageReaction, type PartialUser, type User } from "discord.js";

type Dependencies = {
    readonly client: Client;
    readonly reactionRepository: ReactionRepository;
    readonly emoteRepository: ReactionEmoteRepository;
};

export type ReactionService = object;

export const createReactionService = ({ client, reactionRepository, emoteRepository }: Dependencies): ReactionService => {
    const onReactionAdd = async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
        reaction = await reaction.fetch();
        const message = await reaction.message.fetch();
        const emoji = reaction.emoji;
        const name = emoji.name;
        const discordId = emoji.id;

        if (name === null) {
            throw new Error("Missing emoji name (this should never happen)");
        }

        const giverId = user.id;
        const receiverId = message.author.id;
        const channelId = message.channel.id;
        const messageId = message.id;
        const emote = await emoteRepository.findOrCreate(name, discordId);

        await reactionRepository.create({ giverId, receiverId, channelId, messageId, emoteId: emote.id });
    };

    client.on(Events.MessageReactionAdd, onReactionAdd);

    return {};
};
