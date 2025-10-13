import type { MessageArchiveService } from "@core/services/MessageArchiveService.js";
import type { GeminiLlmService } from "@infrastructure/services/GeminiLlmService.js";
import type { Message, TextChannel } from "discord.js";

export type DiscordChatService = {
    readonly replaceUserAndRoleMentions: (message: Message) => Promise<string>;
    readonly handleMessageCreated: (message: Message) => Promise<void>;
};

export type DiscordChatServiceDeps = {
    readonly geminiLlmService: GeminiLlmService;
    readonly messageArchiveService: MessageArchiveService;
};

function hasBeenPinged(latestMessage: Message): boolean {
    const id = process.env.DISCORD_CLIENT_ID!;
    const mentionedByUser = latestMessage.mentions.users.has(id);
    const mentionedRoles = Array.from(latestMessage.mentions.roles.values());
    const mentionedByRole = mentionedRoles.find(r => Array.from(r.members.values()).find(m => m.id === id)) !== undefined;

    return !latestMessage.mentions.everyone && (mentionedByUser || mentionedByRole);
}

//Replaces a Discord user/role mention with new text.
function replaceMention(input: string, id: string, newText: string = ""): string {
    const regex = new RegExp(`<@&?${id}>`);
    return input.replace(regex, newText);
}

export const createDiscordChatService = ({ geminiLlmService, messageArchiveService }: DiscordChatServiceDeps): DiscordChatService => {
    //Removes the bot's mention from the message content, and replace all user and role pings with their names.
    async function replaceUserAndRoleMentions(message: Message) {
        const channel = (await message.channel.fetch()) as TextChannel;
        const guild = await message.guild?.fetch();
        const members = new Map(Array.from(channel?.members ?? []));
        const roles = new Map(Array.from((await guild?.roles.fetch()) ?? []));

        let result = message.content;
        result = replaceMention(result, process.env.DISCORD_CLIENT_ID!);
        result = replaceMention(result, process.env.DISCORD_BOT_ROLE_ID!);

        //Replace user and role mentions with their actual names.
        result = result.replace(/<@(\d+)>/, (_, id) => members.get(id)?.displayName ?? "");
        result = result.replace(/<@&(\d+)>/, (_, id) => roles.get(id)?.name ?? "");
        return result;
    }

    //Responds to a new message when appropriate.
    async function handleMessageCreated(message: Message) {
        if (message.interactionMetadata !== null) return;

        await message.fetch();
        if (!hasBeenPinged(message)) {
            return;
        }

        const channel = (await message.channel.fetch()) as TextChannel;
        let typing = true;
        const _ = (async () => {
            while (typing) {
                await channel.sendTyping();
                await new Promise(res => setTimeout(res, 8000));
            }
        })();

        try {
            //Get previous messages, ensuring we don't include the message that pinged the bot.
            const previousMessages = (await messageArchiveService.getNewestDBMessages(channel.id, 10)).filter(m => m.id !== message.id);

            const content = await replaceUserAndRoleMentions(message);
            const response = await geminiLlmService.generateMessage(content, previousMessages);

            //Messages are capped at 2000 characters
            const messages = splitMessage(response, 2000);
            for (const m of messages) {
                await channel.send(m);
            }
        } finally {
            typing = false;
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
    };
};
