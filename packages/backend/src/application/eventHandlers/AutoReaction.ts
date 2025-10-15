import type { AutoReactionService } from "@core/services/AutoReactionService.js";
import type { DiscordBot } from "@infrastructure/discord/DiscordBot.js";
import { Events } from "discord.js";

export const registerAutoReactionEvents = (autoReactionService: AutoReactionService, registerEventHandler: DiscordBot["registerEventHandler"]): void => {
    registerEventHandler(Events.MessageReactionAdd, autoReactionService.reactionAdded);
    registerEventHandler(Events.MessageCreate, autoReactionService.messageCreated);
};
