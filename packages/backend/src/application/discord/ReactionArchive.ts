import type { RegisterEventHandler } from "@application/discord/EventRegistrar.js";
import type { CreateMessageData } from "@core/entities/Message.js";
import type { ReactionArchiveService } from "@core/services/ReactionArchiveService.js";
import { Events, type Message, type MessageReaction, type OmitPartialGroupDMChannel, type PartialMessage, type PartialMessageReaction, type PartialUser, type User } from "discord.js";

export type ReactionArchive = {
    readonly addReaction: (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => Promise<void>;
    readonly removeReaction: (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => Promise<void>;
    readonly removeReactionsForMessage: (message: OmitPartialGroupDMChannel<Message<boolean> | PartialMessage>) => Promise<void>;
    readonly removeReactionsForEmote: (reaction: MessageReaction | PartialMessageReaction) => Promise<void>;
};

export type ReactionArchiveDeps = {
    reactionArchiveService: ReactionArchiveService;
};

//Discord API errors meaning the message or channel is already gone; nothing left to archive.
const isMissingResourceError = (error: unknown): boolean => {
    if (error && typeof error === "object" && "code" in error) {
        const apiError = error as { code: number };
        return apiError.code === 10003 || apiError.code === 10008;
    }

    return false;
};

//Safety net for race conditions during bot shutdown, where the client is destroyed mid-request.
const isClientDestroyedError = (error: unknown): boolean => {
    return error instanceof Error && error.message.includes("Expected token to be set for this request");
};

const toMessageData = (message: Message): CreateMessageData => ({
    id: message.id,
    authorId: message.author.id,
    channelId: message.channel.id,
    content: message.content,
    referencedMessageId: message.reference ? message.reference.messageId : undefined,
    createdAt: message.createdAt,
    editedAt: message.editedAt,
});

const emoteRef = (reaction: MessageReaction | PartialMessageReaction) => {
    const name = reaction.emoji.name;
    if (!name) {
        throw new Error("Missing reaction emoji name");
    }

    return { name, discordId: reaction.emoji.id ?? "" };
};

export const createReactionArchive = ({ reactionArchiveService }: ReactionArchiveDeps): ReactionArchive => {
    return {
        addReaction: async (reaction, user): Promise<void> => {
            console.log(`[ReactionArchive] addReaction called - user: ${user.id}, emoji: ${reaction.emoji.name}`);
            try {
                const message = await reaction.message.fetch();

                await reactionArchiveService.recordReaction({ message: toMessageData(message), giverId: user.id, emote: emoteRef(reaction) });
            } catch (e: unknown) {
                console.error(`[ReactionArchive] ❌ Error in addReaction - emoji: ${reaction.emoji.name}, error:`, e);
                if (isMissingResourceError(e)) {
                    return;
                }

                if (!isClientDestroyedError(e)) {
                    console.error("Error adding reaction to message", e);
                }
            }
        },

        removeReaction: async (reaction, user): Promise<void> => {
            try {
                const message = await reaction.message.fetch();

                await reactionArchiveService.removeReaction({
                    messageId: message.id,
                    channelId: message.channel.id,
                    receiverId: message.author.id,
                    giverId: user.id,
                    emote: emoteRef(reaction),
                });
            } catch (e: unknown) {
                if (!isClientDestroyedError(e)) {
                    console.error("Error removing reaction from message", e);
                }
            }
        },

        removeReactionsForMessage: async (message): Promise<void> => {
            try {
                await message.fetch();
                await reactionArchiveService.removeReactionsForMessage(message.id);
            } catch (e: unknown) {
                if (!isClientDestroyedError(e)) {
                    console.error("Error removing reaction from message", e);
                }
            }
        },

        removeReactionsForEmote: async (reaction): Promise<void> => {
            try {
                await reaction.fetch();
                await reactionArchiveService.removeReactionsForEmote(reaction.message.id, emoteRef(reaction));
            } catch (e: unknown) {
                if (!isClientDestroyedError(e)) {
                    console.error("Error removing reactions for emote", e);
                }
            }
        },
    };
};

export const registerReactionArchiveEvents = (reactionArchive: ReactionArchive, registerEventHandler: RegisterEventHandler): void => {
    registerEventHandler(Events.MessageReactionAdd, reactionArchive.addReaction);
    registerEventHandler(Events.MessageReactionRemove, reactionArchive.removeReaction);
    registerEventHandler(Events.MessageReactionRemoveAll, reactionArchive.removeReactionsForMessage);
    registerEventHandler(Events.MessageReactionRemoveEmoji, reactionArchive.removeReactionsForEmote);
};
