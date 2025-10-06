import type { Message } from "@core/entities/Message";
import { type GenerateContentConfig, GoogleGenAI } from "@google/genai";

//gemini-2.5-pro is another option but is much slower.
const model = "gemini-2.5-flash";

export type GeminiLlmService = {
    readonly generateMessage: (input: string, previousMessages?: Message[]) => Promise<string>;
};

export const createGeminiLlmService = (): GeminiLlmService => {
    const apiKey = process.env.LLM_API_KEY;
    if (!apiKey) {
        throw new Error("Missing LLM API key in createLlmChatService");
    }

    const systemInstruction = process.env.LLM_SYSTEM_INSTRUCTION;
    if (!systemInstruction) {
        throw new Error("Missing LLM system instruction in createLlmChatService");
    }

    const ai = new GoogleGenAI({ apiKey });
    const config: GenerateContentConfig = { systemInstruction };

    //Generates a message with optional previous messages.
    async function generateMessage(input: string, messages: Message[] = []) {
        const history = messages.map(m => ({
            role: m.authorId === process.env.DISCORD_CLIENT_ID ? "model" : "user",
            parts: [{ text: m.content }],
        }));

        const chat = ai.chats.create({ model, history, config });
        const response = await chat.sendMessage({ message: input });
        return response.text ?? "";
    }

    return {
        generateMessage,
    };
};
