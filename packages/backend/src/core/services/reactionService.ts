import type { ReactionRepository } from "@core/repositories/ReactionRepository";
import { type Client, Events, MessageReaction, type MessageReactionEventDetails, type PartialMessageReaction, type PartialUser, type User } from "discord.js";

type Dependencies = {
    readonly client: Client;
    readonly reactionRepository: ReactionRepository;
}

export type ReactionService = object

export const createReactionService = ({ client, reactionRepository }: Dependencies): ReactionService => {

    const onReactionAdd = (reaction: (MessageReaction | PartialMessageReaction), user: (User | PartialUser), details: MessageReactionEventDetails) => {
        console.log(reaction, user, details);
    };

    client.on(Events.MessageReactionAdd, onReactionAdd);

    return {};
};