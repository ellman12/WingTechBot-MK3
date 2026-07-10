import type { Config } from "@core/config/Config.js";
import type { Message as DBMessage } from "@core/entities/Message.js";
import type { DiscordChatService } from "@core/services/DiscordChatService.js";
import { resolveAuthorNames } from "@core/utils/batchUtils.js";
import { type GenerateContentConfig, GoogleGenAI } from "@google/genai";
import type { Message, TextChannel } from "discord.js";

//gemini-2.5-pro is another option but is much slower.
const model = "gemini-2.5-flash";

export type GeminiLlmService = {
    readonly generateResponse: (message: Message, previousMessages?: DBMessage[], systemInstruction?: string) => Promise<string>;
    readonly generateStandaloneMessage: (input: string) => Promise<string>;
};

export type GeminiLlmServiceDeps = {
    readonly config: Config;
    readonly discordChatService: DiscordChatService;
};

export const createGeminiLlmService = ({ config, discordChatService }: GeminiLlmServiceDeps): GeminiLlmService => {
    const botId = config.discord.clientId;
    const apiKey = config.llm.apiKey;

    if (!apiKey) {
        throw new Error("Missing LLM API key in createLlmChatService");
    }

    const ai = new GoogleGenAI({ apiKey });

    //Generates a response to a Discord message with optional previous messages from the DB.
    async function generateResponse(message: Message, messages: DBMessage[] = [], systemInstruction = "") {
        const authorIds = messages.map(m => m.authorId);
        const authorNames = await resolveAuthorNames(message.channel as TextChannel, authorIds);
        const nameFor = (authorId: string) => authorNames.get(authorId) ?? `User ${authorId}`;

        const history = messages.map(m => ({
            role: m.authorId === botId ? "model" : "user",
            parts: [{ text: m.authorId === botId ? m.content : `${nameFor(m.authorId)}: ${m.content}` }],
        }));

        const input = await discordChatService.replaceUserRoleAndChannelMentions(message);
        const formattedInput = `${nameFor(message.author.id)}: ${input}`;

        const config: GenerateContentConfig = {
            systemInstruction,
            tools: [{ googleSearch: {} }, { codeExecution: {} }, { urlContext: {} }],
        };
        const chat = ai.chats.create({ model, history, config });
        const response = await chat.sendMessage({ message: formattedInput });
        return response.text ?? "";
    }

    //Generates a standalone message, from our system instructions or otherwise.
    async function generateStandaloneMessage(input: string) {
        const config: GenerateContentConfig = {
            tools: [{ googleSearch: {} }, { codeExecution: {} }, { urlContext: {} }],
        };

        const response = await ai.models.generateContent({ model, contents: input, config });
        return response.text ?? "";
    }

    return {
        generateResponse,
        generateStandaloneMessage,
    };
};
