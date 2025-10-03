import type { LlmChatService } from "@core/services/LlmChatService";
import { type ContentListUnion, GoogleGenAI } from "@google/genai";

// export type LlmChatServiceDeps = {}

//gemini-2.5-pro is another option but is much slower.
const model = "gemini-2.5-flash";

const config = {};

export const createLlmChatService = (): LlmChatService => {
    const ai = new GoogleGenAI({
        apiKey: process.env.LLM_API_KEY,
    });

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

    return {
        generateMessage,
    };
};
