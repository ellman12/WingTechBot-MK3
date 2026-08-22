import type { Config } from "@core/config/Config.js";
import type { Message } from "@core/entities/Message.js";
import type { LlmInstructionRepository } from "@core/ports/repositories/LlmInstructionRepository.js";
import type { MessageRepository } from "@core/ports/repositories/MessageRepository.js";
import type { LlmService, LlmTurn } from "@core/ports/services/LlmService.js";

//How far back the bot looks for conversation context.
const withinMinutes = 15;
const previousMessageLimit = 10;

export type LlmConversationInput = {
    readonly channelId: string;
    readonly messageId: string;
    readonly authorId: string;
    readonly authorName: string;
    readonly content: string;
    //Batch-resolves display names for the authors of the previous messages. Supplied by the caller because it needs the Discord API.
    readonly resolveAuthorNames: (authorIds: string[]) => Promise<Map<string, string>>;
};

export type LlmConversationService = {
    //Generates a reply to a message, seeded with the recent conversation in that channel. Throws LlmUnavailableError when the LLM is down.
    readonly respond: (input: LlmConversationInput) => Promise<string>;
};

export type LlmConversationServiceDeps = {
    readonly config: Config;
    readonly messageRepository: MessageRepository;
    readonly llmService: LlmService;
    readonly llmInstructionRepo: LlmInstructionRepository;
};

export const createLlmConversationService = ({ config, messageRepository, llmService, llmInstructionRepo }: LlmConversationServiceDeps): LlmConversationService => {
    const botId = config.discord.clientId;

    async function getRecentMessages(channelId: string, messageId: string): Promise<Message[]> {
        try {
            //Get recent, previous messages, ensuring we don't include the message that pinged the bot.
            const messages = await messageRepository.getNewestMessages(previousMessageLimit, channelId, withinMinutes);
            return messages.filter(m => m.id !== messageId);
        } catch (e: unknown) {
            console.error("Error getting newest DB messages", e);
            return [];
        }
    }

    async function respond({ channelId, messageId, authorId, authorName, content, resolveAuthorNames }: LlmConversationInput): Promise<string> {
        const previousMessages = await getRecentMessages(channelId, messageId);

        if (config.server.environment === "development") {
            console.log(`Previous messages within ${withinMinutes} minutes:`, previousMessages);
        }

        const names = await resolveAuthorNames(previousMessages.filter(m => m.authorId !== botId).map(m => m.authorId));
        const nameFor = (id: string) => names.get(id) ?? `User ${id}`;

        const history: LlmTurn[] = previousMessages.map(m => (m.authorId === botId ? { role: "model", content: m.content } : { role: "user", content: m.content, authorName: nameFor(m.authorId) }));

        const prompt: LlmTurn = { role: "user", content, authorName: names.get(authorId) ?? authorName };

        const systemInstruction = await llmInstructionRepo.getInstruction("generalChat");
        return await llmService.generateReply({ prompt, history, systemInstruction });
    }

    return {
        respond,
    };
};
