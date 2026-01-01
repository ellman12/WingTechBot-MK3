import type { Message } from "@core/entities/Message.js";
import { type GenerateContentConfig, GoogleGenAI } from "@google/genai";
import { getConfig } from "@infrastructure/config/Config.js";

//gemini-2.5-pro is another option but is much slower.
const model = "gemini-2.5-flash";

export type GeminiLlmService = {
    readonly generateMessage: (input: string, previousMessages?: Message[], systemInstruction?: string) => Promise<string>;
};

export const createGeminiLlmService = (): GeminiLlmService => {
    const botId = getConfig().discord.clientId;
    const apiKey = getConfig().llm.apiKey;

    if (!apiKey) {
        throw new Error("Missing LLM API key in createLlmChatService");
    }

    const ai = new GoogleGenAI({ apiKey });

    //Generates a message with optional previous messages.
    async function generateMessage(input: string, messages: Message[] = [], systemInstruction = "") {
        const history = messages.map(m => ({
            role: m.authorId === botId ? "model" : "user",
            parts: [{ text: m.content }],
        }));

        const config: GenerateContentConfig = { systemInstruction };
        const chat = ai.chats.create({ model, history, config });
        const response = await chat.sendMessage({ message: input });
        return response.text ?? "";
    }

    return {
        generateMessage,
    };
};
