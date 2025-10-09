import type { ReactionScoldService } from "@core/services/ReactionScoldService.js";
import type { ReactionService } from "@core/services/ReactionService.js";
import type { DiscordBot } from "@infrastructure/discord/DiscordBot.js";
import { Events } from "discord.js";

export const registerReactionEvents = (reactionService: ReactionService, reactionScoldService: ReactionScoldService, registerEventHandler: DiscordBot["registerEventHandler"]): void => {
    registerEventHandler(Events.MessageReactionAdd, reactionService.addReaction);
    registerEventHandler(Events.MessageReactionAdd, reactionScoldService.reactionAdded);
    registerEventHandler(Events.MessageReactionRemove, reactionService.removeReaction);
    registerEventHandler(Events.MessageReactionRemoveAll, reactionService.removeReactionsForMessage);
    registerEventHandler(Events.MessageReactionRemoveEmoji, reactionService.removeReactionsForEmote);
};
