import type { LlmInstructionRepository } from "@adapters/repositories/LlmInstructionRepository.js";
import type { DiscordChatService } from "@core/services/DiscordChatService.js";
import type { MessageArchiveService } from "@core/services/MessageArchiveService.js";
import type { GeminiLlmService } from "@infrastructure/services/GeminiLlmService.js";
import { ChannelType, type Message, MessageFlags, type TextChannel } from "discord.js";

export type LlmConversationService = {
    readonly handleMessageCreated: (message: Message) => Promise<void>;
};

export type LlmConversationServiceDeps = {
    readonly discordChatService: DiscordChatService;
    readonly messageArchiveService: MessageArchiveService;
    readonly geminiLlmService: GeminiLlmService;
    readonly llmInstructionRepo: LlmInstructionRepository;
};

export const createLlmConversationService = ({ discordChatService, messageArchiveService, geminiLlmService, llmInstructionRepo }: LlmConversationServiceDeps): LlmConversationService => {
    async function handleMessageCreated(message: Message) {
        if (validMessage(message) && discordChatService.hasBeenPinged(message)) {
            await respondToPing(message);
        }
    }

    function validMessage(message: Message): boolean {
        return message.channel.type !== ChannelType.DM && !message.flags.has(MessageFlags.Ephemeral);
    }

    //Responds to a new message when appropriate.
    async function respondToPing(message: Message) {
        const channel = (await message.channel.fetch()) as TextChannel;
        const controller = new AbortController();
        void discordChatService.sendTypingIndicator(controller.signal, channel);

        try {
            //Get previous messages, ensuring we don't include the message that pinged the bot.
            const previousMessages = (await messageArchiveService.getNewestDBMessages(channel.id, 10)).filter(m => m.id !== message.id);

            const content = await discordChatService.replaceUserAndRoleMentions(message);
            const systemInstruction = await llmInstructionRepo.getInstruction("generalChat");
            const response = await geminiLlmService.generateMessage(content, previousMessages, systemInstruction);
            await discordChatService.sendMessage(response, channel, "split");
        } finally {
            controller.abort();
        }
    }

    return {
        handleMessageCreated,
    };
};
