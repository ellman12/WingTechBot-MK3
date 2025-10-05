import { type ContentListUnion, type GenerateContentConfig, GoogleGenAI } from "@google/genai";

//gemini-2.5-pro is another option but is much slower.
const model = "gemini-2.5-flash";

export type GeminiLlmService = {
    readonly generateMessage: (input: string) => Promise<string>;
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
