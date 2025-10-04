import type { LlmChatService } from "@core/services/LlmChatService";
import { type ContentListUnion, type GenerateContentConfig, GoogleGenAI } from "@google/genai";
import type { Message, TextChannel } from "discord.js";

// export type LlmChatServiceDeps = {}

//gemini-2.5-pro is another option but is much slower.
const model = "gemini-2.5-flash";

function shouldSendMessage(latestMessage: Message) {
    return latestMessage.mentions.users.has(process.env.DISCORD_CLIENT_ID!) && !latestMessage.mentions.everyone;
}

export const createLlmChatService = (): LlmChatService => {
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

    //Generates a message without any prior history.
    async function generateMessage(input: string) {
        const contents: ContentListUnion = [
            {
                role: "user",
                parts: [{ text: input }],
            },
        ];

        const response = await ai.models.generateContentStream({ model, config, contents });

        const chunks = [];
        for await (const chunk of response) {
            if (chunk.text) chunks.push(chunk.text);
        }
        return chunks.join("");
    }

    //Responds to a new message when needed.
    async function handleMessageCreated(message: Message) {
        await message.fetch();
        if (!shouldSendMessage(message)) {
            return;
        }

        const channel = (await message.channel.fetch()) as TextChannel;
        const response = await generateMessage(message.cleanContent);
        await channel.send(response);
    }

    return {
        generateMessage,
        handleMessageCreated,
    };
};
