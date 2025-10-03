export type LlmChatService = {
    readonly generateMessage: (input: string) => Promise<string>;
};
