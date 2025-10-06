import type { GeminiLlmService } from "@adapters/services/GeminiLlmService";
import type { MessageArchiveService } from "@core/services/MessageArchiveService";
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
        await message.fetch();
        if (!hasBeenPinged(message)) {
            return;
        }

        const limit = 40;
        const channel = (await message.channel.fetch()) as TextChannel;
        await channel.sendTyping();

        //Get previous messages, ensuring we don't include the message that pinged the bot.
        const previousMessages = (await messageArchiveService.getNewestDBMessages(channel.id, limit)).filter(m => m.id !== message.id);

        const content = await replaceUserAndRoleMentions(message);
        const response = await geminiLlmService.generateMessage(content, previousMessages);
        await channel.send(response);
    }

    return {
        replaceUserAndRoleMentions,
        handleMessageCreated,
    };
};
