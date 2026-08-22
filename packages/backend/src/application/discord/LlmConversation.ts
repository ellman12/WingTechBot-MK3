import { type DiscordChatService, resolveAuthorNames } from "@application/discord/DiscordChat.js";
import type { RegisterEventHandler } from "@application/discord/EventRegistrar.js";
import type { Config } from "@core/config/Config.js";
import { LlmUnavailableError } from "@core/errors/LlmErrors.js";
import type { BannedFeaturesRepository } from "@core/ports/repositories/BannedFeaturesRepository.js";
import type { LlmConversationService } from "@core/services/LlmConversationService.js";
import { Events, type Message, MessageFlags, type TextChannel } from "discord.js";

export type LlmConversation = {
    readonly handleMessageCreated: (message: Message) => Promise<void>;
};

export type LlmConversationDeps = {
    readonly config: Config;
    readonly discordChatService: DiscordChatService;
    readonly llmConversationService: LlmConversationService;
    readonly bannedFeaturesRepository: BannedFeaturesRepository;
};

//Discord glue for the LLM conversation: decides when the bot should answer and turns Discord messages into core calls.
export const createLlmConversation = ({ config, discordChatService, llmConversationService, bannedFeaturesRepository }: LlmConversationDeps): LlmConversation => {
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
            const content = await discordChatService.replaceUserRoleAndChannelMentions(message);

            const response = await llmConversationService.respond({
                channelId: channel.id,
                messageId: message.id,
                authorId: message.author.id,
                authorName: message.member?.displayName ?? message.author.displayName,
                content,
                resolveAuthorNames: authorIds => resolveAuthorNames(channel, authorIds),
            });

            await discordChatService.sendMessage(response, channel);
        } catch (e: unknown) {
            if (e instanceof LlmUnavailableError) {
                await message.reply("I'm not available right now, please try again later.");
            } else {
                await message.reply("Something went wrong while processing your message.");
            }

            throw e;
        } finally {
            controller.abort();
        }
    }

    return {
        handleMessageCreated,
    };
};

export const registerLlmConversationEvents = (llmConversation: LlmConversation, register: RegisterEventHandler): void => {
    register(Events.MessageCreate, llmConversation.handleMessageCreated);
};
