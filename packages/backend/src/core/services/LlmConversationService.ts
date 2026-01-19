import type { BannedFeaturesRepository } from "@adapters/repositories/BannedFeaturesRepository.js";
import type { Config } from "@core/config/Config.js";
import type { LlmInstructionRepository } from "@core/repositories/LlmInstructionRepository.js";
import type { DiscordChatService } from "@core/services/DiscordChatService.js";
import type { MessageArchiveService } from "@core/services/MessageArchiveService.js";
import type { GeminiLlmService } from "@infrastructure/services/GeminiLlmService.js";
import { type Message, MessageFlags, type TextChannel } from "discord.js";

export type LlmConversationService = {
    readonly handleMessageCreated: (message: Message) => Promise<void>;
};

export type LlmConversationServiceDeps = {
    readonly config: Config;
    readonly discordChatService: DiscordChatService;
    readonly messageArchiveService: MessageArchiveService;
    readonly geminiLlmService: GeminiLlmService;
    readonly llmInstructionRepo: LlmInstructionRepository;
    readonly bannedFeaturesRepository: BannedFeaturesRepository;
};

export const createLlmConversationService = ({ config, discordChatService, messageArchiveService, geminiLlmService, llmInstructionRepo, bannedFeaturesRepository }: LlmConversationServiceDeps): LlmConversationService => {
    async function handleMessageCreated(message: Message) {
        if (config.llm.disabled) return;

        const banned = await bannedFeaturesRepository.isUserBanned(message.author.id, "LlmConversations");
        if (banned) {
            await message.author.send("You are forbidden to speak with me");
            return;
        }

        if (validMessage(message) && discordChatService.hasBeenPinged(message)) {
            await respondToPing(message);
        }
    }

    function validMessage(message: Message): boolean {
        return !message.flags.has(MessageFlags.Ephemeral);
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
