import type { Message } from "discord.js";

export type LlmChatService = {
    readonly generateMessage: (input: string) => Promise<string>;
    readonly handleMessageCreated: (message: Message) => Promise<void>;
};
