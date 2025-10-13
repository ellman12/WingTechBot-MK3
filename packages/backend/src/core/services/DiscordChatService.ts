import type { FileManager } from "@core/services/FileManager.js";
import type { MessageArchiveService } from "@core/services/MessageArchiveService.js";
import type { GeminiLlmService } from "@infrastructure/services/GeminiLlmService.js";
import type { Message, TextChannel } from "discord.js";

export type DiscordChatService = {
    readonly replaceUserAndRoleMentions: (message: Message) => Promise<string>;
    readonly handleMessageCreated: (message: Message) => Promise<void>;
    readonly sendTypingIndicator: (abortSignal: AbortSignal, channel: TextChannel) => Promise<void>;
};

export type DiscordChatServiceDeps = {
    readonly geminiLlmService: GeminiLlmService;
    readonly messageArchiveService: MessageArchiveService;
    readonly fileManager: FileManager;
};

export const createDiscordChatService = ({ geminiLlmService, messageArchiveService, fileManager }: DiscordChatServiceDeps): DiscordChatService => {
    const botId = process.env.DISCORD_CLIENT_ID!;
    const botRoleId = process.env.DISCORD_BOT_ROLE_ID!;

    //Removes the bot's mention from the message content, and replace all user and role pings with their names.
    async function replaceUserAndRoleMentions(message: Message) {
        const channel = (await message.channel.fetch()) as TextChannel;
        const guild = await message.guild?.fetch();

        const members = channel?.members ?? new Map();
        const roles = (await guild?.roles.fetch()) ?? new Map();

        return message.content.replace(/<@&?(\d+)>/g, (_, id) => {
            if (id === botId || id === botRoleId) return "";
            if (roles.has(id)) return roles.get(id)!.name;
            if (members.has(id)) return members.get(id)!.displayName;
            return "";
        });
    }

    //Responds to a new message when appropriate.
    async function handleMessageCreated(message: Message) {
        if (message.interactionMetadata !== null) return;

        await message.fetch();
        if (!hasBeenPinged(message)) {
            return;
        }

        const channel = (await message.channel.fetch()) as TextChannel;
        const controller = new AbortController();
        sendTypingIndicator(controller.signal, channel);

        try {
            //Get previous messages, ensuring we don't include the message that pinged the bot.
            const previousMessages = (await messageArchiveService.getNewestDBMessages(channel.id, 10)).filter(m => m.id !== message.id);

            const content = await replaceUserAndRoleMentions(message);
            const systemInstruction = await fileManager.readFile("./llmInstructions/generalChat.txt");
            const response = await geminiLlmService.generateMessage(content, previousMessages, systemInstruction);

            //Messages are capped at 2000 characters
            const messages = splitMessage(response, 2000);
            for (const m of messages) {
                await channel.send(m);
            }
        } finally {
            controller.abort();
        }
    }

    function hasBeenPinged(latestMessage: Message): boolean {
        const mentionedByUser = latestMessage.mentions.users.has(botId);
        const mentionedRoles = Array.from(latestMessage.mentions.roles.values());
        const mentionedByRole = mentionedRoles.find(r => Array.from(r.members.values()).find(m => m.id === botId)) !== undefined;

        return !latestMessage.mentions.everyone && (mentionedByUser || mentionedByRole);
    }

    //Repeatedly sends the indicator saying the bot is "typing" until told to stop.
    async function sendTypingIndicator(abortSignal: AbortSignal, channel: TextChannel): Promise<void> {
        while (!abortSignal.aborted) {
            await channel.sendTyping();
            await new Promise(res => setTimeout(res, 8000));
        }
    }

    //Helper function to split text intelligently
    function splitMessage(text: string, maxLen: number): string[] {
        if (text.length <= maxLen) return [text];

        const parts: string[] = [];
        let remaining = text;

        while (remaining.length > maxLen) {
            //Try to break at a sentence boundary or space near the limit
            let splitIndex = remaining.lastIndexOf("\n", maxLen);
            if (splitIndex === -1) splitIndex = remaining.lastIndexOf(". ", maxLen);
            if (splitIndex === -1) splitIndex = remaining.lastIndexOf(" ", maxLen);
            if (splitIndex === -1) splitIndex = maxLen; //Fallback hard split

            const chunk = remaining.slice(0, splitIndex + 1).trim();
            parts.push(chunk);
            remaining = remaining.slice(splitIndex + 1).trim();
        }

        if (remaining.length > 0) parts.push(remaining);
        return parts;
    }

    return {
        replaceUserAndRoleMentions,
        handleMessageCreated,
        sendTypingIndicator,
    };
};
