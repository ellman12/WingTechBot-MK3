import type { ReactionService } from "@core/services/ReactionService";
import type { DiscordBot } from "@infrastructure/discord/DiscordBot";
import { Events } from "discord.js";

export const registerReactionEvents = (reactionService: ReactionService, registerEventHandler: DiscordBot["registerEventHandler"]): void => {
    registerEventHandler(Events.MessageReactionAdd, reactionService.addReaction);
    registerEventHandler(Events.MessageReactionRemove, reactionService.removeReaction);
    registerEventHandler(Events.MessageReactionRemoveAll, reactionService.removeReactionsForMessage);
    registerEventHandler(Events.MessageReactionRemoveEmoji, reactionService.removeReactionsForEmote);
};
