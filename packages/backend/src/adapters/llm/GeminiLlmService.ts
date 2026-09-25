import type { Config } from "@core/config/Config.js";
import { LlmError, LlmUnavailableError } from "@core/errors/LlmErrors.js";
import type { LlmReplyInput, LlmService, LlmTurn } from "@core/ports/services/LlmService.js";
import { ApiError, type GenerateContentConfig, GoogleGenAI } from "@google/genai";

//gemini-2.5-pro is another option but is much slower.
const model = "gemini-2.5-flash";

const tools = [{ googleSearch: {} }, { codeExecution: {} }, { urlContext: {} }];

export type GeminiLlmServiceDeps = {
    readonly config: Config;
};

//Attributes a turn to its author ("Name: text") so the model can tell participants apart. Model turns are never attributed.
function renderTurn({ role, content, authorName }: LlmTurn): string {
    return role === "user" && authorName ? `${authorName}: ${content}` : content;
}

//Translates a vendor error into a core LLM error.
function toLlmError(e: unknown): LlmError {
    if (e instanceof ApiError) return new LlmUnavailableError(e.message, { cause: e });
    return new LlmError(e instanceof Error ? e.message : String(e), { cause: e });
}

//LlmService implementation backed by Google Gemini.
export const createGeminiLlmService = ({ config }: GeminiLlmServiceDeps): LlmService => {
    const apiKey = config.llm.apiKey;

    if (!apiKey) {
        throw new Error("Missing LLM API key in createGeminiLlmService");
    }

    const ai = new GoogleGenAI({ apiKey });

    async function generateReply({ prompt, history = [], systemInstruction = "" }: LlmReplyInput): Promise<string> {
        const contents = history.map(turn => ({
            role: turn.role,
            parts: [{ text: renderTurn(turn) }],
        }));

        const generateConfig: GenerateContentConfig = { systemInstruction, tools };

        try {
            const chat = ai.chats.create({ model, history: contents, config: generateConfig });
            const response = await chat.sendMessage({ message: renderTurn(prompt) });
            return response.text ?? "";
        } catch (e: unknown) {
            throw toLlmError(e);
        }
    }

    //Generates a standalone message, from our system instructions or otherwise.
    async function generateStandaloneMessage(input: string): Promise<string> {
        const generateConfig: GenerateContentConfig = { tools };

        try {
            const response = await ai.models.generateContent({ model, contents: input, config: generateConfig });
            return response.text ?? "";
        } catch (e: unknown) {
            throw toLlmError(e);
        }
    }

    return {
        generateReply,
        generateStandaloneMessage,
    };
};
