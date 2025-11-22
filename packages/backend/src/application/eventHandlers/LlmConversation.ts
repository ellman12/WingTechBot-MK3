import type { LlmConversationService } from "@core/services/LlmConversationService.js";
import type { DiscordBot } from "@infrastructure/discord/DiscordBot.js";
import { Events } from "discord.js";

export const registerLlmConversationServiceEventHandlers = (llmConversationService: LlmConversationService, registerEventHandler: DiscordBot["registerEventHandler"]): void => {
    registerEventHandler(Events.MessageCreate, llmConversationService.handleMessageCreated);
};
