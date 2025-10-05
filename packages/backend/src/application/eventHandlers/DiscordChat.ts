import type { DiscordChatService } from "@core/services/DiscordChatService";
import type { DiscordBot } from "@infrastructure/discord/DiscordBot";
import { Events } from "discord.js";

export const registerDiscordChatEventHandlers = (discordChatService: DiscordChatService, registerEventHandler: DiscordBot["registerEventHandler"]): void => {
    registerEventHandler(Events.MessageCreate, discordChatService.handleMessageCreated);
};
