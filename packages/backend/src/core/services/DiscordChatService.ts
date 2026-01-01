import { getConfig } from "@infrastructure/config/Config";
import { type ChatInputCommandInteraction, type InteractionReplyOptions, type Message, type MessageCreateOptions, MessageFlags, type TextChannel } from "discord.js";

export const MESSAGE_LENGTH_LIMIT = 2000;

export type SendMode = "split" | "file";

export type DiscordChatService = {
    readonly hasBeenPinged: (latestMessage: Message) => boolean;
    readonly replaceUserAndRoleMentions: (message: Message) => Promise<string>;
    readonly sendTypingIndicator: (abortSignal: AbortSignal, channel: TextChannel) => Promise<void>;
    readonly formatMessageContent: (content: string, sendMode?: SendMode) => MessageCreateOptions[];
    readonly sendMessage: (content: string, channel: TextChannel, sendMode?: SendMode) => Promise<void>;
    readonly replyToInteraction: (interaction: ChatInputCommandInteraction, content: string, ephemeral?: boolean) => Promise<void>;
    readonly followUpToInteraction: (interaction: ChatInputCommandInteraction, content: string, ephemeral?: boolean) => Promise<void>;
};

//Helpers and utilities for sending/receiving Discord messages.
export const createDiscordChatService = (): DiscordChatService => {
    const botId = getConfig().discord.clientId;
    const botRoleId = getConfig().discord.roleId;

    function hasBeenPinged(latestMessage: Message): boolean {
        const mentionedByUser = latestMessage.mentions.users.has(botId);
        const mentionedRoles = Array.from(latestMessage.mentions.roles.values());
        const mentionedByRole = mentionedRoles.find(r => r.members.get(botId)) !== undefined;

        return !latestMessage.mentions.everyone && (mentionedByUser || mentionedByRole);
    }

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

    //Repeatedly sends the indicator saying the bot is "typing" until told to stop.
    async function sendTypingIndicator(abortSignal: AbortSignal, channel: TextChannel): Promise<void> {
        while (!abortSignal.aborted) {
            await channel.sendTyping();
            await new Promise(res => setTimeout(res, 8000));
        }
    }

    //Formats string content using one of several modes to ensure it fits under 2000 characters.
    function formatMessageContent(content: string, sendMode: SendMode = "split"): MessageCreateOptions[] {
        if (sendMode === "file") {
            const attachment = Buffer.from(content, "utf-8");
            const files = [{ attachment, name: "response.txt" }];
            return [{ files }];
        }

        return splitMessage(content, MESSAGE_LENGTH_LIMIT).map(m => ({ content: m }));
    }

    //Sends a message to a channel with the ability to split it or send as a file.
    async function sendMessage(content: string, channel: TextChannel, sendMode: SendMode = "split"): Promise<void> {
        const result = formatMessageContent(content, sendMode);

        for (const r of result) {
            await channel.send(r);
        }
    }

    //Calls reply on the interaction, sending the result back as a file if content is too long.
    async function replyToInteraction(interaction: ChatInputCommandInteraction, content: string, ephemeral = false) {
        const mode = content.length > MESSAGE_LENGTH_LIMIT ? "file" : "split";
        const result = formatMessageContent(content, mode)[0]!;
        const formatted: InteractionReplyOptions = { ...result, flags: ephemeral ? MessageFlags.Ephemeral : undefined };

        await interaction.reply(formatted);
    }

    //Calls followUp on the interaction, sending the result back as a file if content is too long.
    async function followUpToInteraction(interaction: ChatInputCommandInteraction, content: string, ephemeral = false) {
        const mode = content.length > MESSAGE_LENGTH_LIMIT ? "file" : "split";
        const result = formatMessageContent(content, mode)[0]!;
        const formatted: InteractionReplyOptions = { ...result, flags: ephemeral ? MessageFlags.Ephemeral : undefined };

        await interaction.followUp(formatted);
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
        hasBeenPinged,
        replaceUserAndRoleMentions,
        sendTypingIndicator,
        formatMessageContent,
        sendMessage,
        replyToInteraction,
        followUpToInteraction,
    };
};
