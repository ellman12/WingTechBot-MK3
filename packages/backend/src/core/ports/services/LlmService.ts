//One turn of a conversation as seen by the LLM. `authorName` lets implementations attribute user turns ("Name: text").
export type LlmTurn = {
    readonly role: "user" | "model";
    readonly content: string;
    readonly authorName?: string;
};

export type LlmReplyInput = {
    readonly prompt: LlmTurn;
    readonly history?: readonly LlmTurn[];
    readonly systemInstruction?: string;
};

//Port for a large-language-model backend. Implementations must translate vendor errors into core/errors/LlmErrors.
export type LlmService = {
    //Generates a reply to `prompt`, seeded with prior conversation turns and a system instruction.
    readonly generateReply: (input: LlmReplyInput) => Promise<string>;
    //Generates a standalone message from a single input (e.g. a system instruction used as the prompt).
    readonly generateStandaloneMessage: (input: string) => Promise<string>;
};
