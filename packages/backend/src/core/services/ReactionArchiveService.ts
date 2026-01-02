import type { Config } from "@core/config/Config.js";
import type { MessageRepository } from "@core/repositories/MessageRepository.js";
import type { ReactionEmoteRepository } from "@core/repositories/ReactionEmoteRepository.js";
import type { ReactionRepository } from "@core/repositories/ReactionRepository.js";
import { shouldProcessChannel } from "@core/utils/channelFilter.js";
import type { Message, MessageReaction, OmitPartialGroupDMChannel, PartialMessage, PartialMessageReaction, PartialUser, User } from "discord.js";

export type ReactionArchiveService = {
    readonly addReaction: (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => Promise<void>;
    readonly removeReaction: (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => Promise<void>;
    readonly removeReactionsForMessage: (message: OmitPartialGroupDMChannel<Message<boolean> | PartialMessage>) => Promise<void>;
    readonly removeReactionsForEmote: (reaction: MessageReaction | PartialMessageReaction) => Promise<void>;
};

export type ReactionArchiveServiceDeps = {
    config: Config;
    messageRepository: MessageRepository;
    reactionRepository: ReactionRepository;
    emoteRepository: ReactionEmoteRepository;
};

// Helper to check if error is due to Discord client being destroyed/token missing
// This is a safety net for race conditions during bot shutdown
const isClientDestroyedError = (error: unknown): boolean => {
    return error instanceof Error && error.message.includes("Expected token to be set for this request");
};

//Archives all reactions added to all messages.
export const createReactionArchiveService = ({ config, messageRepository, reactionRepository, emoteRepository }: ReactionArchiveServiceDeps): ReactionArchiveService => {
    console.log("[ReactionArchiveService] Creating reaction archive service");

    return {
        addReaction: async (reaction, user): Promise<void> => {
            console.log(`[ReactionArchiveService] addReaction called - user: ${user.id}, emoji: ${reaction.emoji.name}`);
            try {
                const message = await reaction.message.fetch();
                const channel = message.channel;

                // Skip if channel is not in the allowed list
                if (!shouldProcessChannel(message.channelId, config)) {
                    return;
                }

                const year = message.createdAt.getUTCFullYear();

                if (year < new Date().getUTCFullYear()) {
                    console.warn("🚫 Ignoring added reaction older than this year.");
                    return;
                }

                const emoteName = reaction.emoji.name;

                if (!emoteName) {
                    throw new Error("Missing reaction emoji name");
                }

                // Ensure the message exists in the database before adding a reaction
                // This handles race conditions where a reaction arrives before the message is saved
                const referencedMessageId = message.reference ? message.reference.messageId : undefined;
                await messageRepository.create({
                    id: message.id,
                    authorId: message.author.id,
                    channelId: channel.id,
                    content: message.content,
                    referencedMessageId,
                    createdAt: message.createdAt,
                    editedAt: message.editedAt,
                });

                const reactionEmote = await emoteRepository.create(emoteName, reaction.emoji.id ?? "");

                const data = { giverId: user.id, receiverId: message.author.id, channelId: channel.id, messageId: message.id, emoteId: reactionEmote.id };
                await reactionRepository.create(data);
                console.log(`[ReactionArchiveService] ✅ Successfully saved reaction - emoji: ${emoteName}, channel: ${channel.id}`);
            } catch (e: unknown) {
                console.error(`[ReactionArchiveService] ❌ Error in addReaction - emoji: ${reaction.emoji.name}, error:`, e);
                // Handle Discord API errors for deleted/unknown channels/messages
                if (e && typeof e === "object" && "code" in e) {
                    const apiError = e as { code: number };
                    if (apiError.code === 10003 || apiError.code === 10008) {
                        // 10003 = Unknown Channel, 10008 = Unknown Message
                        // Silently skip - channel/message was deleted
                        return;
                    }
                }
                // Ignore errors when bot is being destroyed (token no longer available)
                if (!isClientDestroyedError(e)) {
                    console.error("Error adding reaction to message", e);
                }
            }
        },

        removeReaction: async (reaction, user): Promise<void> => {
            try {
                const message = await reaction.message.fetch();
                const channel = message.channel;

                // Skip if channel is not in the allowed list
                if (!shouldProcessChannel(message.channelId, config)) {
                    return;
                }

                const year = message.createdAt.getUTCFullYear();

                if (year < new Date().getUTCFullYear()) {
                    console.warn("🚫 Ignoring removed reaction older than this year.");
                    return;
                }

                const emoteName = reaction.emoji.name;

                if (!emoteName) {
                    throw new Error("Missing reaction emoji name");
                }

                const reactionEmote = await emoteRepository.findByNameAndDiscordId(emoteName, reaction.emoji.id ?? "");

                if (!reactionEmote) {
                    console.warn("Skipping removal of reaction because reaction emote not found");
                    return;
                }

                const data = { giverId: user.id, receiverId: message.author.id, channelId: channel.id, messageId: message.id, emoteId: reactionEmote.id };
                await reactionRepository.delete(data);
            } catch (e: unknown) {
                // Ignore errors when bot is being destroyed (token no longer available)
                // Also ignore errors when the channel/message no longer exists (race condition with deletion)
                if (!isClientDestroyedError(e)) {
                    console.error("Error removing reaction from message", e);
                }
            }
        },

        removeReactionsForMessage: async (message): Promise<void> => {
            try {
                await message.fetch();

                // Skip if channel is not in the allowed list
                if (!shouldProcessChannel(message.channelId, config)) {
                    return;
                }

                const year = message.createdAt.getUTCFullYear();

                if (year < new Date().getUTCFullYear()) {
                    console.warn("🚫 Ignoring removed reactions from message older than this year.");
                    return;
                }

                await reactionRepository.deleteReactionsForMessage(message.id);
            } catch (e: unknown) {
                // Ignore errors when bot is being destroyed (token no longer available)
                // Also ignore errors when the channel/message no longer exists (race condition with deletion)
                if (!isClientDestroyedError(e)) {
                    console.error("Error removing reaction from message", e);
                }
            }
        },

        removeReactionsForEmote: async (reaction): Promise<void> => {
            try {
                await reaction.fetch();

                // Skip if channel is not in the allowed list
                if (!shouldProcessChannel(reaction.message.channelId, config)) {
                    return;
                }

                const year = reaction.message.createdAt.getUTCFullYear();
                const name = reaction.emoji.name;

                if (year < new Date().getUTCFullYear()) {
                    console.warn(`🚫 Ignoring removed reaction for emote ${name} older than this year.`);
                    return;
                }

                if (!name) {
                    throw new Error("Missing emoji name in removeReactionsForEmote");
                }

                const emote = await emoteRepository.findByNameAndDiscordId(name, reaction.emoji.id ?? "");

                if (!emote) {
                    throw new Error("Emote not found in removeReactionsForEmote");
                }

                await reactionRepository.deleteReactionsForEmote(reaction.message.id, emote.id);
            } catch (e: unknown) {
                // Ignore errors when bot is being destroyed (token no longer available)
                // Also ignore errors when the channel/message no longer exists (race condition with deletion)
                if (!isClientDestroyedError(e)) {
                    console.error("Error removing reactions for emote", e);
                }
            }
        },
    };
};
