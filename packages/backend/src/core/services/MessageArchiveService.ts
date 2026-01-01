import type { CreateMessageData, Message as DBMessage } from "@core/entities/Message.js";
import type { MessageRepository } from "@core/repositories/MessageRepository.js";
import type { ReactionEmoteRepository } from "@core/repositories/ReactionEmoteRepository.js";
import type { ReactionRepository } from "@core/repositories/ReactionRepository.js";
import type { UnitOfWork } from "@core/repositories/UnitOfWork.js";
import { ChannelType, Collection, DiscordAPIError, type FetchMessagesOptions, type Guild, type Message, MessageFlags, type OmitPartialGroupDMChannel, type PartialMessage, type TextChannel } from "discord.js";
import equal from "fast-deep-equal/es6/index.js";

export type MessageArchiveService = {
    readonly fetchAllMessages: (channel: TextChannel, endYear?: number) => Promise<Message[]>;

    //Walk backwards through each channel, and store/update each message until told to stop or hit the last message.
    readonly processAllChannels: (guild: Guild, endYear?: number) => Promise<void>;

    //Remove any messages from the DB that no longer exist on Discord.
    readonly removeDeletedMessages: (guild: Guild, endYear?: number) => Promise<void>;

    readonly messageCreated: (message: Message) => Promise<void>;

    readonly messageDeleted: (message: OmitPartialGroupDMChannel<Message<boolean> | PartialMessage>) => Promise<void>;

    readonly messageEdited: (oldMessage: OmitPartialGroupDMChannel<Message<boolean> | PartialMessage>, newMessage: OmitPartialGroupDMChannel<Message<boolean>>) => Promise<void>;

    readonly getAllDBMessages: (year?: number) => Promise<DBMessage[]>;

    readonly getNewestDBMessages: (channelId: string, limit: number) => Promise<DBMessage[]>;
};

export type MessageArchiveServiceDeps = {
    unitOfWork: UnitOfWork;
    messageRepository: MessageRepository;
    reactionRepository: ReactionRepository;
    emoteRepository: ReactionEmoteRepository;
};

async function processMessage(
    discordMessage: Message,
    existingMessages: Map<string, DBMessage>,
    unitOfWork: UnitOfWork,
    messageRepository: MessageRepository,
    reactionRepository: ReactionRepository,
    emoteRepository: ReactionEmoteRepository
): Promise<boolean> {
    if (discordMessage.partial) {
        await discordMessage.fetch();
    }

    const messageId = discordMessage.id;
    const channelId = discordMessage.channelId;
    const authorId = discordMessage.author.id;
    const content = discordMessage.content;
    let created = false;

    //Add message if not already in DB, otherwise edit content if needed.
    let existingMsg = existingMessages.get(messageId);
    if (existingMsg && existingMsg.content !== discordMessage.content) {
        await messageRepository.edit({ id: messageId, content });
        console.log(`Edited content of message from ${discordMessage.author.username} in #${(discordMessage.channel as TextChannel).name}`);
    } else if (!existingMsg) {
        // Collect reaction data first (outside transaction to avoid long-running transaction during Discord API calls)
        const reactionDataToCreate: Array<{ giverId: string; receiverId: string; channelId: string; messageId: string; emoteId: number }> = [];

        for (const reaction of discordMessage.reactions.cache.values()) {
            try {
                const name = reaction.emoji.name!;
                const emote = await emoteRepository.create(name, reaction.emoji.id ?? "");

                await reaction.users.fetch();
                for (const user of reaction.users.cache.values()) {
                    const reactionData = { giverId: user.id, receiverId: authorId, channelId, messageId, emoteId: emote.id };
                    reactionDataToCreate.push(reactionData);
                }
            } catch (error: unknown) {
                // Skip reactions for deleted messages or other API errors
                if (error && typeof error === "object" && "code" in error) {
                    const apiError = error as { code: number };
                    if (apiError.code === 10008) {
                        console.log(`[MessageArchiveService] Skipping reactions for deleted message: ${messageId}`);
                        continue;
                    }
                }
                // Re-throw unexpected errors
                throw error;
            }
        }

        // Wrap message creation and reaction creation in a single transaction
        existingMsg = await unitOfWork.execute(async repos => {
            const referencedMessageId = discordMessage.reference ? discordMessage.reference.messageId : undefined;
            const message = await repos.messageRepository.create({
                id: messageId,
                authorId,
                channelId,
                content,
                referencedMessageId,
                createdAt: discordMessage.createdAt,
                editedAt: discordMessage.editedAt,
            });

            // Create all reactions within the same transaction
            for (const reactionData of reactionDataToCreate) {
                await repos.reactionRepository.create(reactionData);
            }

            return message;
        });

        console.log(`Added message "${discordMessage.content}" from ${discordMessage.author.username} in #${(discordMessage.channel as TextChannel).name}`);
        created = true;
    }

    //Handle reactions for existing messages
    if (existingMsg) {
        const existingReactions = existingMsg.reactions;

        //Build a set of "current reactions" from Discord.
        const discordReactions: typeof existingReactions = [];

        // Collect reaction data
        const reactionDataToCreate: Array<{ giverId: string; receiverId: string; channelId: string; messageId: string; emoteId: number }> = [];

        for (const reaction of discordMessage.reactions.cache.values()) {
            try {
                const name = reaction.emoji.name!;
                const emote = await emoteRepository.create(name, reaction.emoji.id ?? "");

                await reaction.users.fetch();
                for (const user of reaction.users.cache.values()) {
                    const reactionData = { giverId: user.id, receiverId: authorId, channelId, messageId, emoteId: emote.id };
                    discordReactions.push(reactionData);

                    //Check if reaction needs to be added
                    const existingReaction = existingReactions.find(r => equal(r, reactionData));
                    if (!existingReaction) {
                        reactionDataToCreate.push(reactionData);
                    }
                }
            } catch (error: unknown) {
                // Skip reactions for deleted messages or other API errors
                if (error && typeof error === "object" && "code" in error) {
                    const apiError = error as { code: number };
                    if (apiError.code === 10008) {
                        console.log(`[MessageArchiveService] Skipping reactions for deleted message: ${messageId}`);
                        continue;
                    }
                }
                // Re-throw unexpected errors
                throw error;
            }
        }

        // Create new reactions
        for (const reactionData of reactionDataToCreate) {
            await reactionRepository.create(reactionData);
        }

        //Remove reactions that exist in DB but not on Discord
        for (const existingReaction of existingReactions) {
            const stillExists = discordReactions.some(r => equal(r, existingReaction));
            if (!stillExists) {
                await reactionRepository.delete(existingReaction);
            }
        }
    }

    return created;
}

async function getMessage(guild: Guild, channelId: string, messageId: string): Promise<Message | null> {
    //Instead of returning null it errors if the message doesn't exist :(
    try {
        const channel = await guild.channels.fetch(channelId);
        if (!channel || !channel.isTextBased()) {
            // Channel doesn't exist or is not a text channel - message is effectively deleted
            return null;
        }
        return await (channel as TextChannel).messages.fetch(messageId);
    } catch (error) {
        if (error instanceof DiscordAPIError) {
            // 10008 = Unknown Message (message was deleted)
            // 10003 = Unknown Channel (channel was deleted)
            if (error.code === 10008 || error.code === 10003) {
                return null;
            }
            console.error(`❌ Failed to fetch message ${messageId} in channel ${channelId}:`, error);
        } else {
            console.error(`❌ Failed to fetch message ${messageId} in channel ${channelId}:`, error);
        }
    }

    return null;
}

function validMessage(message: Message): boolean {
    return message.channel.type !== ChannelType.DM && !message.flags.has(MessageFlags.Ephemeral);
}

export const createMessageArchiveService = ({ unitOfWork, messageRepository, reactionRepository, emoteRepository }: MessageArchiveServiceDeps): MessageArchiveService => {
    console.log("[MessageArchiveService] Creating message archive service");

    async function fetchAllMessages(channel: TextChannel, endYear?: number) {
        const allMessages: Message[] = [];
        let messages = new Collection<string, Message>();
        let lastId: string | null = null;

        do {
            const options: FetchMessagesOptions = { limit: 100, before: lastId ?? undefined };
            messages = await channel.messages.fetch(options);
            lastId = messages.last()?.id ?? null;
            for (const message of messages.values()) {
                if (endYear !== undefined && message.createdAt.getUTCFullYear() !== endYear) break;

                allMessages.push(message);
            }
        } while (messages.size > 0);

        return allMessages;
    }

    async function processAllChannels(guild: Guild, endYear?: number): Promise<void> {
        console.log(`💬 Begin processing messages in all channels ${endYear ? `for ${endYear}` : "for all years"}`);
        await guild.channels.fetch();
        const textChannels = Array.from(guild.channels.cache.filter(c => c.type === ChannelType.GuildText).values());

        await Promise.all(
            textChannels.map(async channel => {
                const name = channel.name;
                console.log(`🗨️ Begin processing messages in #${name}`);

                const discordMessages = await fetchAllMessages(channel, endYear);
                const existingMessages = await messageRepository.getAllMessagesAsMap(endYear);
                console.log(`🗨️ Fetched ${discordMessages.length} messages from #${name}`);

                const results = await Promise.all(discordMessages.map(message => processMessage(message, existingMessages, unitOfWork, messageRepository, reactionRepository, emoteRepository)));
                const amountAdded = results.filter(Boolean).length;

                if (amountAdded > 0) {
                    console.log(`💾 Added ${amountAdded} messages from #${name}`);
                }

                console.log(`🗨️ Finish processing messages in #${name}`);
            })
        );

        console.log("💬 Finish processing all messages in all channels");
    }

    async function removeDeletedMessages(guild: Guild, endYear?: number) {
        await guild.channels.fetch();

        const messages = await messageRepository.getAllMessages(endYear);

        let deleted = 0;

        for (const message of messages) {
            const fetched = await getMessage(guild, message.channelId, message.id);
            if (!fetched) {
                await messageRepository.delete({ id: message.id });
                deleted++;
            }
        }

        if (deleted > 0) {
            console.log(`🗑️ Removed ${deleted} deleted messages`);
        }
    }

    async function messageCreated(message: Message): Promise<void> {
        if (!validMessage(message)) {
            return;
        }

        if (message.partial) {
            await message.fetch();
        }

        try {
            const referencedMessageId = message.reference ? message.reference.messageId : undefined;
            const data: CreateMessageData = {
                id: message.id,
                authorId: message.author.id,
                channelId: message.channelId,
                content: message.content,
                referencedMessageId,
                createdAt: message.createdAt,
                editedAt: message.editedAt,
            };
            await messageRepository.create(data);
        } catch (e: unknown) {
            console.error("Error adding message to database", e, message.content);
        }
    }

    async function messageDeleted(message: OmitPartialGroupDMChannel<Message<boolean> | PartialMessage>): Promise<void> {
        if (!validMessage(message as Message)) {
            return;
        }

        if (message.partial) {
            await message.fetch();
        }

        try {
            await messageRepository.delete({ id: message.id });
        } catch (e: unknown) {
            // Ignore "Message does not exist" errors - the message is already not in the DB
            if (e instanceof Error && e.message === "Message does not exist") {
                return;
            }
            console.error("Error removing message from database", e, message.content);
        }
    }

    async function messageEdited(oldMessage: OmitPartialGroupDMChannel<Message<boolean> | PartialMessage>, newMessage: OmitPartialGroupDMChannel<Message<boolean>>): Promise<void> {
        if (!validMessage(newMessage)) {
            return;
        }

        if (newMessage.partial) {
            await newMessage.fetch();
        }

        try {
            const id = newMessage.id;
            await messageRepository.edit({ id, content: newMessage.content });
        } catch (e: unknown) {
            console.error("Error updating content of message", e, newMessage.content);
        }
    }

    async function getAllDBMessages(year?: number): Promise<DBMessage[]> {
        try {
            return await messageRepository.getAllMessages(year);
        } catch (e: unknown) {
            console.error("Error getting all DB messages", e);
        }

        return [];
    }

    async function getNewestDBMessages(channelId: string, limit: number) {
        try {
            return await messageRepository.getNewestMessages(channelId, limit);
        } catch (e: unknown) {
            console.error("Error getting newest DB messages", e);
        }

        return [];
    }

    return {
        fetchAllMessages,
        processAllChannels,
        removeDeletedMessages,
        messageCreated,
        messageDeleted,
        messageEdited,
        getAllDBMessages,
        getNewestDBMessages,
    };
};
