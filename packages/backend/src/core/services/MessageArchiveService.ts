import type { CreateMessageData, Message as DBMessage } from "@core/entities/Message.js";
import type { MessageRepository } from "@core/repositories/MessageRepository.js";
import type { UnitOfWork } from "@core/repositories/UnitOfWork.js";
import { ChannelType, Collection, type FetchMessagesOptions, type Guild, type Message, MessageFlags, type OmitPartialGroupDMChannel, type PartialMessage, type TextChannel } from "discord.js";

export type MessageArchiveService = {
    readonly fetchAllMessages: (channel: TextChannel, endYear?: number) => Promise<Message[]>;

    //Walk backwards through each channel, and store/update each message until told to stop or hit the last message.
    readonly processAllChannels: (guild: Guild, endYear?: number, channelIds?: string[]) => Promise<void>;

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
};

/**
 * Collects reaction data from a Discord message.
 * Returns emote info and reaction data for later batch processing.
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

            // Add unique emote
            if (!emotes.some(e => e.name === name && e.discordId === emoteDiscordId)) {
                emotes.push({ name, discordId: emoteDiscordId });
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
                const existingMessages = await messageRepository.getAllMessagesAsMap(endYear);
                console.log(`🗨️ Fetched ${discordMessages.length} messages from #${name}`);

                // Filter to only valid messages (exclude DMs, ephemeral messages, etc.)
                const validDiscordMessages = discordMessages.filter(validMessage);
                console.log(`🗨️ ${validDiscordMessages.length} valid messages in #${name}`);

                // Step 1: Collect all reaction data from Discord messages
                const allReactionData = await Promise.all(validDiscordMessages.map(collectReactionData));
                const allEmotes = allReactionData.flatMap(d => d.emotes);
                const allReactions = allReactionData.flatMap(d => d.reactions);

                // Step 2: Batch create/fetch all unique emotes
                let emoteCache: Map<string, { id: number }> = new Map();
                if (allEmotes.length > 0) {
                    emoteCache = await unitOfWork.execute(async repos => {
                        return await repos.emoteRepository.batchFindOrCreate(allEmotes);
                    });
                }

                // Step 3: Categorize messages into new, updated, or unchanged
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
                        // New message
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
                        // Updated message
                        messagesToUpdate.push({ id: messageId, content: discordMessage.content });
                    }
                }

                // Step 4: Build target reaction state with emote IDs
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

                // Step 5: Get existing reactions and calculate diff
                const existingReactions = Array.from(existingMessages.values()).flatMap(m => m.reactions);

                // Create sets for efficient comparison
                const makeKey = (r: { giverId: string; receiverId: string; channelId: string; messageId: string; emoteId: number }) => `${r.giverId}:${r.receiverId}:${r.channelId}:${r.messageId}:${r.emoteId}`;

                const targetSet = new Set(targetReactions.map(makeKey));
                const existingSet = new Set(existingReactions.map(makeKey));

                // Calculate what to add and remove
                const reactionsToAdd = targetReactions.filter(r => !existingSet.has(makeKey(r)));
                const reactionsToRemove = existingReactions.filter(r => !targetSet.has(makeKey(r)));

                // Step 6: Execute batch operations in a transaction
                console.log(`[DEBUG] Channel ${name}: About to start transaction`);
                console.log(`[DEBUG] Channel ${name}: messagesToCreate=${messagesToCreate.length}, messagesToUpdate=${messagesToUpdate.length}`);
                console.log(`[DEBUG] Channel ${name}: reactionsToAdd=${reactionsToAdd.length}, reactionsToRemove=${reactionsToRemove.length}`);
                console.log(`[DEBUG] Channel ${name}: existingMessages count=${existingMessages.size}`);

                // Log message IDs being created
                if (messagesToCreate.length > 0) {
                    console.log(`[DEBUG] Channel ${name}: Message IDs to create: ${messagesToCreate.map(m => m.id).join(", ")}`);
                }

                // Log reaction message IDs
                if (reactionsToAdd.length > 0) {
                    const uniqueMessageIds = [...new Set(reactionsToAdd.map(r => r.messageId))];
                    console.log(`[DEBUG] Channel ${name}: Reactions for message IDs: ${uniqueMessageIds.join(", ")}`);

                    // Check if all reaction message IDs are in messagesToCreate or existingMessages
                    for (const msgId of uniqueMessageIds) {
                        const isInCreate = messagesToCreate.some(m => m.id === msgId);
                        const isInExisting = existingMessages.has(msgId);
                        console.log(`[DEBUG] Channel ${name}: Message ${msgId} - inCreate=${isInCreate}, inExisting=${isInExisting}`);
                        if (!isInCreate && !isInExisting) {
                            console.error(`[ERROR] Channel ${name}: Message ${msgId} is NOT in messagesToCreate and NOT in existingMessages!`);
                        }
                    }
                }

                await unitOfWork.execute(async repos => {
                    // Batch create new messages
                    if (messagesToCreate.length > 0) {
                        console.log(`[DEBUG] Channel ${name}: Creating ${messagesToCreate.length} messages`);
                        await repos.messageRepository.batchCreate(messagesToCreate);
                        console.log(`[DEBUG] Channel ${name}: Successfully created messages`);
                    }

                    // Batch update edited messages
                    if (messagesToUpdate.length > 0) {
                        console.log(`[DEBUG] Channel ${name}: Updating ${messagesToUpdate.length} messages`);
                        await repos.messageRepository.batchUpdate(messagesToUpdate);
                        console.log(`[DEBUG] Channel ${name}: Successfully updated messages`);
                    }

                    // Batch delete removed reactions
                    if (reactionsToRemove.length > 0) {
                        console.log(`[DEBUG] Channel ${name}: Deleting ${reactionsToRemove.length} reactions`);
                        await repos.reactionRepository.batchDelete(reactionsToRemove);
                        console.log(`[DEBUG] Channel ${name}: Successfully deleted reactions`);
                    }

                    // Batch create new reactions
                    if (reactionsToAdd.length > 0) {
                        console.log(`[DEBUG] Channel ${name}: Creating ${reactionsToAdd.length} reactions`);
                        await repos.reactionRepository.batchCreate(reactionsToAdd);
                        console.log(`[DEBUG] Channel ${name}: Successfully created reactions`);
                    }
                });

                console.log(`[DEBUG] Channel ${name}: Transaction completed successfully`);

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

        // Process each channel's messages
        for (const [channelId, channelMessages] of messagesByChannel) {
            // Fetch channel once for all messages in this channel
            let channel: TextChannel | null = null;
            try {
                const fetchedChannel = await guild.channels.fetch(channelId);
                if (fetchedChannel && fetchedChannel.isTextBased()) {
                    channel = fetchedChannel as TextChannel;
                }
            } catch {
                // Channel doesn't exist or bot doesn't have access - mark all messages for deletion
                console.log(`Channel ${channelId} not found, marking ${channelMessages.length} messages for deletion`);
                messagesToDelete.push(...channelMessages.map(m => m.id));
                continue;
            }

            if (!channel) {
                messagesToDelete.push(...channelMessages.map(m => m.id));
                continue;
            }

            // If we have many messages to check in this channel, fetch all messages in bulk
            // Otherwise, check individually (more efficient for small counts)
            if (channelMessages.length > 20) {
                // Fetch all messages from channel in bulk (100 at a time)
                const existingIds = new Set<string>();
                let lastId: string | undefined;
                let fetchedCount = 0;

                // For deletion checking, we need to be thorough and check all messages
                // The DB query already filters by year, so we only check a limited set
                // But we need to fetch all Discord messages to verify they exist
                while (true) {
                    try {
                        const fetched = await channel.messages.fetch({ limit: 100, before: lastId });
                        if (fetched.size === 0) break;

                        fetched.forEach(msg => existingIds.add(msg.id));
                        fetchedCount += fetched.size;
                        lastId = fetched.last()?.id;

                        // If we fetched less than 100, we've reached the end
                        if (fetched.size < 100) break;

                        // Safety limit: stop after 10,000 messages
                        if (fetchedCount >= 10000) {
                            console.warn(`⚠️ Reached 10,000-message fetch limit for channel ${channel.id}. Some older messages may not be checked for deletion.`);
                            break;
                        }
                    } catch {
                        break;
                    }
                }

                // Check which of our messages don't exist
                for (const message of channelMessages) {
                    if (!existingIds.has(message.id)) {
                        messagesToDelete.push(message.id);
                    }
                }
            } else {
                // For small counts, individual fetches are more efficient
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

                    // Collect IDs of messages that don't exist
                    for (const result of results) {
                        if (!result.exists) {
                            messagesToDelete.push(result.id);
                        }
                    }
                }
            }
        }

        console.log(`🔍 Found ${messagesToDelete.length} messages to delete`);

        // Batch delete all non-existent messages
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
            // Ignore "Message does not exist" errors - the message is already not in the DB
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
