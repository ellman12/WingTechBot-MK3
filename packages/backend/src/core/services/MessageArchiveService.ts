import type { CreateMessageData, Message as DBMessage } from "@core/entities/Message.js";
import type { MessageRepository } from "@core/repositories/MessageRepository.js";
import type { UnitOfWork } from "@core/repositories/UnitOfWork.js";
import { ChannelType, Collection, type FetchMessagesOptions, type Guild, type Message, MessageFlags, type OmitPartialGroupDMChannel, type PartialMessage, type TextChannel } from "discord.js";

export type MessageArchiveService = {
    readonly fetchAllMessages: (channel: TextChannel, endYear?: number) => Promise<Message[]>;

    readonly processAllChannels: (guild: Guild, endYear?: number, channelIds?: string[]) => Promise<void>;

    readonly removeDeletedMessages: (guild: Guild, endYear?: number) => Promise<void>;

    readonly messageCreated: (message: Message) => Promise<void>;

    readonly messageDeleted: (message: OmitPartialGroupDMChannel<Message<boolean> | PartialMessage>) => Promise<void>;

    readonly messageEdited: (oldMessage: OmitPartialGroupDMChannel<Message<boolean> | PartialMessage>, newMessage: OmitPartialGroupDMChannel<Message<boolean>>) => Promise<void>;

    readonly getAllDBMessages: (year?: number) => Promise<DBMessage[]>;

    readonly getNewestDBMessages: (channelId: string, limit: number) => Promise<DBMessage[]>;

    readonly hasAnyMessages: () => Promise<boolean>;
};

export type MessageArchiveServiceDeps = {
    unitOfWork: UnitOfWork;
    messageRepository: MessageRepository;
};

/**
 * Collects reaction data for batch processing to minimize database round trips.
 */
async function collectReactionData(discordMessage: Message) {
    const messageId = discordMessage.id;
    const authorId = discordMessage.author.id;
    const channelId = discordMessage.channelId;

    const emotes: Array<{ name: string; discordId: string }> = [];
    const reactions: Array<{ giverId: string; receiverId: string; channelId: string; messageId: string; emoteName: string; emoteDiscordId: string }> = [];

    for (const reaction of discordMessage.reactions.cache.values()) {
        try {
            const name = reaction.emoji.name!;
            const emoteDiscordId = reaction.emoji.id ?? "";

            await reaction.users.fetch();
            for (const user of reaction.users.cache.values()) {
                reactions.push({
                    giverId: user.id,
                    receiverId: authorId,
                    channelId,
                    messageId,
                    emoteName: name,
                    emoteDiscordId,
                });
            }

            if (!emotes.some(e => e.name === name && e.discordId === emoteDiscordId)) {
                emotes.push({ name, discordId: emoteDiscordId });
            }
        } catch (error: unknown) {
            if (error && typeof error === "object" && "code" in error) {
                const apiError = error as { code: number };
                if (apiError.code === 10008) {
                    console.log(`[MessageArchiveService] Skipping reactions for deleted message: ${messageId}`);
                    continue;
                }
            }
            throw error;
        }
    }

    return { emotes, reactions };
}

function validMessage(message: Message): boolean {
    return message.channel.type !== ChannelType.DM && !message.flags.has(MessageFlags.Ephemeral);
}

export const createMessageArchiveService = ({ unitOfWork, messageRepository }: MessageArchiveServiceDeps): MessageArchiveService => {
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

    async function processAllChannels(guild: Guild, endYear?: number, channelIds?: string[]): Promise<void> {
        console.log(`💬 Begin processing messages in ${channelIds ? `${channelIds.length} specified channel(s)` : "all channels"} ${endYear ? `for ${endYear}` : "for all years"}`);
        await guild.channels.fetch();

        let textChannels = Array.from(guild.channels.cache.filter(c => c.type === ChannelType.GuildText).values());

        // Filter to specific channels if provided
        if (channelIds && channelIds.length > 0) {
            textChannels = textChannels.filter(c => channelIds.includes(c.id));
        }

        await Promise.all(
            textChannels.map(async channel => {
                const name = channel.name;
                console.log(`🗨️ Begin processing messages in #${name}`);

                const discordMessages = await fetchAllMessages(channel, endYear);
                const existingMessagesArray = await messageRepository.getMessagesForChannel(channel.id, endYear);
                const existingMessages = new Map(existingMessagesArray.map(m => [m.id, m]));
                console.log(`🗨️ Fetched ${discordMessages.length} messages from #${name}`);

                const validDiscordMessages = discordMessages.filter(validMessage);
                console.log(`🗨️ ${validDiscordMessages.length} valid messages in #${name}`);

                // Collect all reaction data from Discord messages for batch processing
                const allReactionData = await Promise.all(validDiscordMessages.map(collectReactionData));
                const allEmotes = allReactionData.flatMap(d => d.emotes);
                const allReactions = allReactionData.flatMap(d => d.reactions);

                // Batch create/fetch all unique emotes to minimize database round trips
                let emoteCache: Map<string, { id: number }> = new Map();
                if (allEmotes.length > 0) {
                    emoteCache = await unitOfWork.execute(async repos => {
                        return await repos.emoteRepository.batchFindOrCreate(allEmotes);
                    });
                }

                // Categorize messages into new, updated, or unchanged
                const messagesToCreate: CreateMessageData[] = [];
                const messagesToUpdate: Array<{ id: string; content: string }> = [];
                let newMessageCount = 0;

                for (const discordMessage of validDiscordMessages) {
                    if (discordMessage.partial) {
                        await discordMessage.fetch();
                    }

                    const messageId = discordMessage.id;
                    const existingMsg = existingMessages.get(messageId);

                    if (!existingMsg) {
                        const referencedMessageId = discordMessage.reference ? discordMessage.reference.messageId : undefined;
                        messagesToCreate.push({
                            id: messageId,
                            authorId: discordMessage.author.id,
                            channelId: discordMessage.channelId,
                            content: discordMessage.content,
                            referencedMessageId,
                            createdAt: discordMessage.createdAt,
                            editedAt: discordMessage.editedAt,
                        });
                        newMessageCount++;
                    } else if (existingMsg.content !== discordMessage.content) {
                        messagesToUpdate.push({ id: messageId, content: discordMessage.content });
                    }
                }

                // Build target reaction state with emote IDs from cache
                const targetReactions = allReactions.map(r => {
                    const emoteKey = `${r.emoteName}:${r.emoteDiscordId}`;
                    const emote = emoteCache.get(emoteKey);
                    if (!emote) {
                        throw new Error(`Emote not found in cache: ${emoteKey}`);
                    }
                    return {
                        giverId: r.giverId,
                        receiverId: r.receiverId,
                        channelId: r.channelId,
                        messageId: r.messageId,
                        emoteId: emote.id,
                    };
                });

                // Calculate diff between target and existing reactions using set operations
                const existingReactions = Array.from(existingMessages.values()).flatMap(m => m.reactions);

                const makeKey = (r: { giverId: string; receiverId: string; channelId: string; messageId: string; emoteId: number }) => `${r.giverId}:${r.receiverId}:${r.channelId}:${r.messageId}:${r.emoteId}`;

                const targetSet = new Set(targetReactions.map(makeKey));
                const existingSet = new Set(existingReactions.map(makeKey));

                const reactionsToAdd = targetReactions.filter(r => !existingSet.has(makeKey(r)));
                const reactionsToRemove = existingReactions.filter(r => !targetSet.has(makeKey(r)));

                // Execute batch operations in smaller chunks to avoid large transactions
                const BATCH_SIZE = 100;

                for (let i = 0; i < messagesToCreate.length; i += BATCH_SIZE) {
                    const batch = messagesToCreate.slice(i, i + BATCH_SIZE);
                    await unitOfWork.execute(async repos => {
                        await repos.messageRepository.batchCreate(batch);
                    });
                }

                for (let i = 0; i < messagesToUpdate.length; i += BATCH_SIZE) {
                    const batch = messagesToUpdate.slice(i, i + BATCH_SIZE);
                    await unitOfWork.execute(async repos => {
                        await repos.messageRepository.batchUpdate(batch);
                    });
                }

                for (let i = 0; i < reactionsToRemove.length; i += BATCH_SIZE) {
                    const batch = reactionsToRemove.slice(i, i + BATCH_SIZE);
                    await unitOfWork.execute(async repos => {
                        await repos.reactionRepository.batchDelete(batch);
                    });
                }

                for (let i = 0; i < reactionsToAdd.length; i += BATCH_SIZE) {
                    const batch = reactionsToAdd.slice(i, i + BATCH_SIZE);
                    await unitOfWork.execute(async repos => {
                        await repos.reactionRepository.batchCreate(batch);
                    });
                }

                if (newMessageCount > 0) {
                    console.log(`💾 Added ${newMessageCount} messages to #${name}`);
                }
                if (messagesToUpdate.length > 0) {
                    console.log(`✏️ Updated ${messagesToUpdate.length} messages in #${name}`);
                }

                console.log(`🗨️ Finish processing messages in #${name}`);
            })
        );

        console.log("💬 Finish processing all messages in all channels");
    }

    async function removeDeletedMessages(guild: Guild, endYear?: number) {
        await guild.channels.fetch();

        const messages = await messageRepository.getAllMessages(endYear);

        if (messages.length === 0) {
            return;
        }

        console.log(`🔍 Checking ${messages.length} messages for deletions...`);

        // Group messages by channel to minimize channel fetches
        const messagesByChannel = new Map<string, DBMessage[]>();
        for (const message of messages) {
            const channelMessages = messagesByChannel.get(message.channelId) || [];
            channelMessages.push(message);
            messagesByChannel.set(message.channelId, channelMessages);
        }

        const messagesToDelete: string[] = [];
        const batchSize = 10;

        for (const [channelId, channelMessages] of messagesByChannel) {
            let channel: TextChannel | null = null;
            try {
                const fetchedChannel = await guild.channels.fetch(channelId);
                if (fetchedChannel && fetchedChannel.isTextBased()) {
                    channel = fetchedChannel as TextChannel;
                }
            } catch {
                console.log(`Channel ${channelId} not found, marking ${channelMessages.length} messages for deletion`);
                messagesToDelete.push(...channelMessages.map(m => m.id));
                continue;
            }

            if (!channel) {
                messagesToDelete.push(...channelMessages.map(m => m.id));
                continue;
            }

            // Use bulk fetch for many messages, individual fetches for few (more efficient for small counts)
            if (channelMessages.length > 20) {
                const existingIds = new Set<string>();
                let lastId: string | undefined;

                while (true) {
                    try {
                        const fetched = await channel.messages.fetch({ limit: 100, before: lastId });
                        if (fetched.size === 0) break;

                        fetched.forEach(msg => existingIds.add(msg.id));
                        lastId = fetched.last()?.id;

                        if (fetched.size < 100) break;
                    } catch {
                        break;
                    }
                }

                for (const message of channelMessages) {
                    if (!existingIds.has(message.id)) {
                        messagesToDelete.push(message.id);
                    }
                }
            } else {
                for (let i = 0; i < channelMessages.length; i += batchSize) {
                    const batch = channelMessages.slice(i, i + batchSize);

                    const results = await Promise.all(
                        batch.map(async message => {
                            try {
                                await channel!.messages.fetch(message.id);
                                return { id: message.id, exists: true };
                            } catch {
                                return { id: message.id, exists: false };
                            }
                        })
                    );

                    for (const result of results) {
                        if (!result.exists) {
                            messagesToDelete.push(result.id);
                        }
                    }
                }
            }
        }

        console.log(`🔍 Found ${messagesToDelete.length} messages to delete`);

        if (messagesToDelete.length > 0) {
            for (const id of messagesToDelete) {
                await messageRepository.delete({ id });
            }
            console.log(`🗑️ Removed ${messagesToDelete.length} deleted messages`);
        } else {
            console.log(`✅ No deleted messages found`);
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
            if (e instanceof Error && e.message === "Message does not exist") {
                return;
            }
            console.error("Error removing message from database", e, message.content);
        }
    }

    async function messageEdited(_oldMessage: OmitPartialGroupDMChannel<Message<boolean> | PartialMessage>, newMessage: OmitPartialGroupDMChannel<Message<boolean>>): Promise<void> {
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
            return await messageRepository.getNewestMessages(limit, channelId);
        } catch (e: unknown) {
            console.error("Error getting newest DB messages", e);
        }

        return [];
    }

    async function hasAnyMessages(): Promise<boolean> {
        try {
            const messages = await messageRepository.getNewestMessages(1);
            return messages.length > 0;
        } catch (e: unknown) {
            console.error("Error checking if any messages exist", e);
            return false;
        }
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
        hasAnyMessages,
    };
};
