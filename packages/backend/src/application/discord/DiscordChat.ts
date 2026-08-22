import type { Config } from "@core/config/Config.js";
import { splitMessage } from "@core/utils/textUtils.js";
import { type ChatInputCommandInteraction, type InteractionReplyOptions, type Message, type MessageCreateOptions, MessageFlags, type TextChannel } from "discord.js";

export const MESSAGE_LENGTH_LIMIT = 2000;

//Batch-resolves display names for the given Discord user IDs. Used to attribute LLM conversation turns to their authors.
export async function resolveAuthorNames(channel: TextChannel, authorIds: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    if (authorIds.length === 0) return names;

    try {
        const members = await channel.guild.members.fetch({ user: authorIds });
        members.forEach(member => names.set(member.id, member.displayName));
    } catch (e: unknown) {
        console.warn("Failed to batch-fetch guild members for LLM context", e);
    }

    return names;
}

export type SendMode = "split" | "file";

//Extra optional params passed to replyToInteraction and followUpToInteraction.
export type ResponseOptions = {
    //If the response is only visible to the invoker of the interaction.
    ephemeral?: boolean;

    //If backticks for Markdown code blocks should automatically be added around the content (unless we're in file mode).
    backticks?: boolean;
};

const DefaultResponseOptions: ResponseOptions = { ephemeral: false, backticks: false };

export type DiscordChatService = {
    readonly hasBeenPinged: (latestMessage: Message) => boolean;
    readonly replaceUserRoleAndChannelMentions: (message: Message) => Promise<string>;
    readonly sendTypingIndicator: (abortSignal: AbortSignal, channel: TextChannel) => Promise<void>;
    readonly formatMessageContent: (content: string, sendMode?: SendMode) => MessageCreateOptions[];
    readonly sendMessage: (content: string, channel: TextChannel, sendMode?: SendMode) => Promise<void>;
    readonly replyToInteraction: (interaction: ChatInputCommandInteraction, content: string, options?: ResponseOptions) => Promise<void>;
    readonly followUpToInteraction: (interaction: ChatInputCommandInteraction, content: string, options?: ResponseOptions) => Promise<void>;
};

export type DiscordChatServiceDeps = {
    readonly config: Config;
};

//Helpers and utilities for sending/receiving Discord messages.
export const createDiscordChatService = ({ config }: DiscordChatServiceDeps): DiscordChatService => {
    const botId = config.discord.clientId;
    const botRoleId = config.discord.roleId;

    function hasBeenPinged(latestMessage: Message): boolean {
        const mentionedByUser = latestMessage.mentions.users.has(botId);
        const mentionedRoles = Array.from(latestMessage.mentions.roles.values());
        const mentionedByRole = mentionedRoles.find(r => r.members.get(botId)) !== undefined;

        return !latestMessage.mentions.everyone && (mentionedByUser || mentionedByRole);
    }

    //Removes the bot's mention from the message content, clean up emotes, replace all user and role pings with their names, and replace channel mentions with channel names.
    async function replaceUserRoleAndChannelMentions(message: Message) {
        const channel = (await message.channel.fetch()) as TextChannel;
        const guild = await message.guild?.fetch();

        const members = channel?.members ?? new Map();
        const roles = (await guild?.roles.fetch()) ?? new Map();
        const channels = (await guild?.channels.fetch()) ?? new Map();

        return message.content.replace(/<[@#]&?(\d+)>/g, (_, id) => {
            if (id === botId || id === botRoleId) return "";
            if (roles.has(id)) return roles.get(id)!.name;
            if (members.has(id)) return members.get(id)!.displayName;
            if (channels.has(id)) return channels.get(id)!.name;
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

    //Formats the response back for Discord interactions.
    function formatResponseContent(content: string, options = DefaultResponseOptions) {
        const { ephemeral, backticks } = options;
        const mode = content.length > MESSAGE_LENGTH_LIMIT ? "file" : "split";
        const enclosingChars = mode === "split" && backticks ? "```" : "";

        //There will never be more than 1 since interactions don't support more than 1 message.
        const result = formatMessageContent(`${enclosingChars}${content}${enclosingChars}`, mode)[0]!;
        return { ...result, flags: ephemeral ? MessageFlags.Ephemeral : undefined } satisfies InteractionReplyOptions;
    }

    //Calls reply on the interaction, sending the result back as a file if content is too long.
    async function replyToInteraction(interaction: ChatInputCommandInteraction, content: string, options = DefaultResponseOptions) {
        const formatted = formatResponseContent(content, options);
        await interaction.reply(formatted);
    }

    //Calls followUp on the interaction, sending the result back as a file if content is too long.
    async function followUpToInteraction(interaction: ChatInputCommandInteraction, content: string, options = DefaultResponseOptions) {
        const formatted = formatResponseContent(content, options);
        await interaction.followUp(formatted);
    }

    return {
        hasBeenPinged,
        replaceUserRoleAndChannelMentions,
        sendTypingIndicator,
        formatMessageContent,
        sendMessage,
        replyToInteraction,
        followUpToInteraction,
    };
};
