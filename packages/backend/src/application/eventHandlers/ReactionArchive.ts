import type { ReactionArchiveService } from "@core/services/ReactionArchiveService.js";
import type { ReactionScoldService } from "@core/services/ReactionScoldService.js";
import type { DiscordBot } from "@infrastructure/discord/DiscordBot.js";
import { Events } from "discord.js";

export const registerReactionArchiveEvents = (reactionArchiveService: ReactionArchiveService, reactionScoldService: ReactionScoldService, registerEventHandler: DiscordBot["registerEventHandler"]): void => {
    registerEventHandler(Events.MessageReactionAdd, reactionArchiveService.addReaction);
    registerEventHandler(Events.MessageReactionAdd, reactionScoldService.reactionAdded);
    registerEventHandler(Events.MessageReactionRemove, reactionArchiveService.removeReaction);
    registerEventHandler(Events.MessageReactionRemoveAll, reactionArchiveService.removeReactionsForMessage);
    registerEventHandler(Events.MessageReactionRemoveEmoji, reactionArchiveService.removeReactionsForEmote);
};
