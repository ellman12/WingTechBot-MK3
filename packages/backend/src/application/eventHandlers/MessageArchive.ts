import type { MessageArchiveService } from "@core/services/MessageArchiveService.js";
import type { DiscordBot } from "@infrastructure/discord/DiscordBot.js";
import { Events } from "discord.js";

export const registerMessageArchiveEvents = (messageArchiveService: MessageArchiveService, registerEventHandler: DiscordBot["registerEventHandler"]): void => {
    registerEventHandler(Events.MessageCreate, messageArchiveService.messageCreated);
    registerEventHandler(Events.MessageDelete, messageArchiveService.messageDeleted);
    registerEventHandler(Events.MessageUpdate, messageArchiveService.messageEdited);
};
