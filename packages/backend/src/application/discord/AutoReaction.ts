import type { DiscordChatService } from "@application/discord/DiscordChat.js";
import type { RegisterEventHandler } from "@application/discord/EventRegistrar.js";
import type { AutoReactionService } from "@core/services/AutoReactionService.js";
import { Events, type Message, type MessageReaction, type PartialMessageReaction, type PartialUser, type TextChannel, type User } from "discord.js";

export type AutoReaction = {
    readonly reactionAdded: (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => Promise<void>;
    readonly messageCreated: (message: Message) => Promise<void>;
};

export type AutoReactionDeps = {
    readonly discordChatService: DiscordChatService;
    readonly autoReactionService: AutoReactionService;
};

// Helper to check if error is due to Discord client being destroyed/token missing
// This is a safety net for race conditions during bot shutdown
const isClientDestroyedError = (error: unknown): boolean => {
    return error instanceof Error && error.message.includes("Expected token to be set for this request");
};

//Discord glue for the auto-reaction rules: feeds plain message data to core and sends whatever it decides to say.
export const createAutoReaction = ({ discordChatService, autoReactionService }: AutoReactionDeps): AutoReaction => {
    async function startTypingIndicator(message: Message, abortSignal: AbortSignal): Promise<void> {
        const channel = (await message.channel.fetch()) as TextChannel;
        await discordChatService.sendTypingIndicator(abortSignal, channel);
    }

    return {
        reactionAdded: async (reaction, user): Promise<void> => {
            try {
                const message = await reaction.message.fetch();
                const fetchedReaction = await reaction.fetch();

                const scold = autoReactionService.getSelfReactionScold({ authorId: message.author.id, reactorId: user.id, emoteName: fetchedReaction.emoji.name });
                if (!scold) return;

                console.log(`[AutoReaction] Sending scold message for self-reaction in channel ${message.channelId}`);
                await message.channel.send(`${scold} <@${user.id}>`);
            } catch (e: unknown) {
                if (!isClientDestroyedError(e)) {
                    console.error("Error checking if added reaction needs to be scolded", e);
                }
            }
        },

        messageCreated: async (message): Promise<void> => {
            const controller = new AbortController();

            try {
                const result = await autoReactionService.evaluateMessage({
                    authorId: message.author.id,
                    authorName: message.member?.displayName ?? message.author.displayName,
                    content: message.content,
                    getCleanedContent: () => discordChatService.replaceUserRoleAndChannelMentions(message),
                    onLlmStart: () => void startTypingIndicator(message, controller.signal).catch(e => console.error("[AutoReaction] Typing indicator failed", e)),
                });

                if (result) await message.reply(result.content);
            } finally {
                controller.abort();
            }
        },
    };
};

export const registerAutoReactionEvents = (autoReaction: AutoReaction, register: RegisterEventHandler): void => {
    register(Events.MessageReactionAdd, autoReaction.reactionAdded);
    register(Events.MessageCreate, autoReaction.messageCreated);
};
