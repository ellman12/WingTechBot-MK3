import type { LlmChatService } from "@core/services/LlmChatService";
import type { DiscordBot } from "@infrastructure/discord/DiscordBot";
import { Events } from "discord.js";

export const registerLlmChatEvents = (llmChatService: LlmChatService, registerEventHandler: DiscordBot["registerEventHandler"]): void => {
    registerEventHandler(Events.MessageCreate, llmChatService.handleMessageCreated);
};
