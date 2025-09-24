import type { MessageService } from "@core/services/MessageService";
import type { DiscordBot } from "@infrastructure/discord/DiscordBot";
import { Events } from "discord.js";

export const registerMessageEvents = (messageService: MessageService, registerEventHandler: DiscordBot["registerEventHandler"]): void => {
    registerEventHandler(Events.MessageCreate, messageService.messageCreated);
    registerEventHandler(Events.MessageDelete, messageService.messageDeleted);
    registerEventHandler(Events.MessageUpdate, messageService.messageEdited);
};
