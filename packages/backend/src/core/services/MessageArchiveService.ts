import type { CreateMessageData, Message as DBMessage } from "@core/entities/Message.js";
import type { MessageRepository } from "@core/repositories/MessageRepository.js";
import type { UnitOfWork } from "@core/repositories/UnitOfWork.js";
import type { FileManager } from "@core/services/FileManager.js";
import { executeBatchWithAdaptiveSize } from "@core/utils/batchUtils.js";
import { ChannelType, type Guild, type Message, MessageFlags, type PartialMessage, type TextChannel } from "discord.js";

export type MessageArchiveService = {
    readonly fetchAllMessages: (channel: TextChannel, endYear?: number) => Promise<Message[]>;

    readonly processAllChannels: (guild: Guild, endYear?: number, channelIds?: string[], resume?: boolean) => Promise<void>;

    readonly messageCreated: (message: Message) => Promise<void>;

    readonly messageDeleted: (message: Message | PartialMessage) => Promise<void>;

    readonly messageEdited: (oldMessage: Message | PartialMessage, newMessage: Message) => Promise<void>;

    readonly getAllDBMessages: (year?: number) => Promise<DBMessage[]>;

    readonly getNewestDBMessages: (channelId: string, limit: number) => Promise<DBMessage[]>;

    readonly hasAnyMessages: () => Promise<boolean>;
};

type SyncProgress = {
    guildId: string;
    endYear?: number;
    channelIds?: string[];
    completedChannels: string[];
    startedAt: string;
    lastUpdatedAt: string;
};

type ChannelFetchCache = {
    discordMessages: Array<{
        id: string;
        authorId: string;
        channelId: string;
        content: string;
        createdAt: Date;
        editedAt: Date | null;
        reactions: Array<{ giverId: string; receiverId: string; emoteName: string; emoteDiscordId: string }>;
    }>;
    emotes: Array<{ name: string; discordId: string }>;
    fetchedAt: string;
};

export type MessageArchiveServiceDeps = {
    unitOfWork: UnitOfWork;
    messageRepository: MessageRepository;
    fileManager: FileManager;
};

// Collects reaction data for batch processing to minimize database round trips.
async function collectReactionData(discordMessage: Message) {
    const messageId = String(discordMessage.id);
    const authorId = String(discordMessage.author.id);
    const channelId = String(discordMessage.channelId);

    const reactionResults = await Promise.all(
        [...discordMessage.reactions.cache.values()].map(async reaction => {
            try {
                const name = reaction.emoji.name!;
                const emoteDiscordId = reaction.emoji.id ?? "";

                await reaction.users.fetch();
                const reactions = [...reaction.users.cache.values()].map(user => ({
                    giverId: String(user.id),
                    receiverId: authorId,
                    channelId,
                    messageId,
                    emoteName: name,
                    emoteDiscordId,
                }));

                return {
                    reactions,
                    emote: { name, discordId: emoteDiscordId },
                };
            } catch (error: unknown) {
                if (error && typeof error === "object" && "code" in error) {
                    const apiError = error as { code: number };
                    if (apiError.code === 10008) {
                        console.log(`[MessageArchiveService] Skipping reactions for deleted message: ${messageId}`);
                        return { reactions: [], emote: null };
                    }
                }
                throw error;
            }
        })
    );

    const reactions = reactionResults.flatMap(r => r.reactions);
    const emotes = reactionResults
        .map(r => r.emote)
        .filter((e): e is { name: string; discordId: string } => e !== null)
        .filter((emote, index, self) => self.findIndex(e => e.name === emote.name && e.discordId === emote.discordId) === index);

    return { emotes, reactions };
}

function validMessage(message: Message): boolean {
    return message.channel.type !== ChannelType.DM && !message.flags.has(MessageFlags.Ephemeral);
}

export const createMessageArchiveService = ({ unitOfWork, messageRepository, fileManager }: MessageArchiveServiceDeps): MessageArchiveService => {
    console.log("[MessageArchiveService] Creating message archive service");

    const getChannelFetchCacheFilename = (channelId: string) => `channel-fetch-cache-${channelId}.json`;

    async function loadChannelFetchCache(channelId: string): Promise<ChannelFetchCache | null> {
        return await fileManager.readCache<ChannelFetchCache>(getChannelFetchCacheFilename(channelId));
    }

    async function saveChannelFetchCache(channelId: string, cache: ChannelFetchCache): Promise<void> {
        await fileManager.writeCache(getChannelFetchCacheFilename(channelId), cache);
    }

    async function clearChannelFetchCache(channelId: string): Promise<void> {
        await fileManager.deleteCache(getChannelFetchCacheFilename(channelId));
    }

    const getProgressFilename = (guildId: string) => `sync-progress-${guildId}.json`;

    const chunkArray = <T>(items: T[], size: number): T[][] => {
        const chunks: T[][] = [];
        for (let i = 0; i < items.length; i += size) {
            chunks.push(items.slice(i, i + size));
        }
        return chunks;
    };

    async function loadProgress(guildId: string): Promise<SyncProgress | null> {
        return await fileManager.readCache<SyncProgress>(getProgressFilename(guildId));
    }

    async function saveProgress(progress: SyncProgress): Promise<void> {
        progress.lastUpdatedAt = new Date().toISOString();
        await fileManager.writeCache(getProgressFilename(progress.guildId), progress);
    }

    async function clearProgress(guildId: string): Promise<void> {
        await fileManager.deleteCache(getProgressFilename(guildId));
    }

    // Helper to fetch reactions in batches with progress tracking
    async function fetchReactionsInBatches(messages: Message[], channelName: string) {
        console.log(`⚡ Fetching reactions for ${messages.length} messages from #${channelName}...`);
        const REACTION_PROGRESS_INTERVAL = 500;
        const PARALLEL_BATCH_SIZE = 10;

        type ReactionData = {
            messageId: string;
            reactions: Array<{ giverId: string; receiverId: string; emoteName: string; emoteDiscordId: string }>;
            emotes: Array<{ name: string; discordId: string }>;
        };

        const batches = chunkArray(messages, PARALLEL_BATCH_SIZE);

        const { data } = await batches.reduce<Promise<{ data: ReactionData[]; total: number }>>(
            async (accPromise, batch, batchIndex) => {
                const acc = await accPromise;

                const batchResults = await Promise.all(
                    batch.map(async msg => {
                        const { reactions, emotes } = await collectReactionData(msg);
                        return { messageId: String(msg.id), reactions, emotes };
                    })
                );

                const totalReactionsFetched = acc.total + batchResults.reduce((sum, r) => sum + r.reactions.length, 0);
                const processedMessages = Math.min((batchIndex + 1) * PARALLEL_BATCH_SIZE, messages.length);

                if (totalReactionsFetched > 0 && (totalReactionsFetched % REACTION_PROGRESS_INTERVAL === 0 || processedMessages === messages.length)) {
                    console.log(`⚡ Progress: ${totalReactionsFetched} reactions from ${processedMessages}/${messages.length} messages`);
                }

                return {
                    data: [...acc.data, ...batchResults],
                    total: totalReactionsFetched,
                };
            },
            Promise.resolve({ data: [], total: 0 })
        );

        return data;
    }

    // Fetch reactions for cached messages by refetching only the specific message IDs
    async function fetchReactionsForCachedMessages(channel: TextChannel, cachedMessages: ChannelFetchCache["discordMessages"], channelName: string) {
        console.log(`⚡ Fetching reactions for ${cachedMessages.length} cached messages from #${channelName}...`);
        const REACTION_PROGRESS_INTERVAL = 500;
        const PARALLEL_BATCH_SIZE = 10;

        type ReactionData = {
            messageId: string;
            reactions: Array<{ giverId: string; receiverId: string; emoteName: string; emoteDiscordId: string }>;
            emotes: Array<{ name: string; discordId: string }>;
        };

        const batches = chunkArray(cachedMessages, PARALLEL_BATCH_SIZE);

        const { data } = await batches.reduce<Promise<{ data: ReactionData[]; total: number; processed: number }>>(
            async (accPromise, batch, batchIndex) => {
                const acc = await accPromise;

                const batchResults = await Promise.all(
                    batch.map(async cachedMsg => {
                        try {
                            const msg = await channel.messages.fetch(cachedMsg.id);
                            const { reactions, emotes } = await collectReactionData(msg);
                            return { messageId: cachedMsg.id, reactions, emotes };
                        } catch (error: unknown) {
                            if (error && typeof error === "object" && "code" in error && (error as { code: number }).code === 10008) {
                                return { messageId: cachedMsg.id, reactions: [], emotes: [] };
                            }
                            throw error;
                        }
                    })
                );

                const totalReactionsFetched = acc.total + batchResults.reduce((sum, r) => sum + r.reactions.length, 0);
                const processedMessages = Math.min((batchIndex + 1) * PARALLEL_BATCH_SIZE, cachedMessages.length);

                if (totalReactionsFetched > 0 && (totalReactionsFetched % REACTION_PROGRESS_INTERVAL === 0 || processedMessages === cachedMessages.length)) {
                    console.log(`⚡ Progress: ${totalReactionsFetched} reactions from ${processedMessages}/${cachedMessages.length} messages`);
                }

                return {
                    data: [...acc.data, ...batchResults],
                    total: totalReactionsFetched,
                    processed: processedMessages,
                };
            },
            Promise.resolve({ data: [], total: 0, processed: 0 })
        );

        return data;
    }

    async function fetchAllMessages(channel: TextChannel, endYear?: number): Promise<Message[]> {
        const PROGRESS_INTERVAL = 5000;

        const fetchBatch = async (beforeId: string | null = null): Promise<{ messages: Message[]; hasMore: boolean }> => {
            const options = { limit: 100, ...(beforeId && { before: beforeId }) };
            const messages = await channel.messages.fetch(options);

            const filteredMessages = [...messages.values()].filter(message => endYear === undefined || message.createdAt.getUTCFullYear() === endYear);

            return {
                messages: filteredMessages,
                hasMore: messages.size > 0,
            };
        };

        const fetchAllRecursive = async (beforeId: string | null, accumulated: Message[]): Promise<Message[]> => {
            const { messages, hasMore } = await fetchBatch(beforeId);
            const newAccumulated = [...accumulated, ...messages];

            // Log progress
            if (newAccumulated.length % PROGRESS_INTERVAL === 0 && newAccumulated.length > 0) {
                console.log(`📥 Fetched ${newAccumulated.length} messages from #${channel.name}`);
            }

            if (!hasMore || messages.length === 0) {
                return newAccumulated;
            }

            const lastMessage = messages[messages.length - 1];
            const lastId = lastMessage ? String(lastMessage.id) : null;
            return fetchAllRecursive(lastId, newAccumulated);
        };

        return fetchAllRecursive(null, []);
    }

    // Unified function that syncs a single channel: creates, updates, deletions, and reactions
    async function syncChannel(channel: TextChannel, endYear?: number): Promise<void> {
        const name = channel.name;
        const channelId = String(channel.id);
        console.log(`🗨️ Begin syncing #${name}`);

        // Try to load cached Discord data
        const cachedFetch = await loadChannelFetchCache(channelId);

        let discordMessages: ChannelFetchCache["discordMessages"];
        let allEmotes: Array<{ name: string; discordId: string }>;
        let allReactions: Array<{ giverId: string; receiverId: string; channelId: string; messageId: string; emoteName: string; emoteDiscordId: string }>;

        // Use cache if available, otherwise fetch from Discord
        if (cachedFetch) {
            console.log(`📦 Using cached data for #${name} (${cachedFetch.discordMessages.length} messages from ${cachedFetch.fetchedAt})`);

            // Deserialize dates from JSON strings back to Date objects
            discordMessages = cachedFetch.discordMessages.map(msg => ({
                ...msg,
                createdAt: new Date(msg.createdAt),
                editedAt: msg.editedAt ? new Date(msg.editedAt) : null,
            }));

            allEmotes = cachedFetch.emotes;

            // Reconstruct full reaction list from cached messages
            allReactions = discordMessages.flatMap(msg =>
                msg.reactions.map(r => ({
                    giverId: r.giverId,
                    receiverId: r.receiverId,
                    channelId: msg.channelId,
                    messageId: msg.id,
                    emoteName: r.emoteName,
                    emoteDiscordId: r.emoteDiscordId,
                }))
            );

            // Check if we need to fetch reactions (cache might only have messages)
            const hasReactions = allReactions.length > 0 || allEmotes.length > 0;
            if (!hasReactions) {
                console.log(`⚠️ Cache has messages but no reactions, fetching reactions now...`);

                // Fetch reactions only for the cached message IDs instead of re-fetching all messages
                const allReactionDataByMessage = await fetchReactionsForCachedMessages(channel, discordMessages, name);

                // Build emote set (deduplicated)
                const emoteSet = new Map<string, { name: string; discordId: string }>();
                allReactionDataByMessage.forEach(data => {
                    data.emotes.forEach(emote => {
                        const key = `${emote.name}:${emote.discordId}`;
                        emoteSet.set(key, emote);
                    });
                });
                allEmotes = [...emoteSet.values()];

                // Update messages with reactions
                discordMessages = discordMessages.map(msg => {
                    const messageReactionData = allReactionDataByMessage.find(r => r.messageId === msg.id);
                    return {
                        ...msg,
                        reactions: messageReactionData?.reactions || [],
                    };
                });

                // Build full reaction list for database operations
                allReactions = discordMessages.flatMap(msg =>
                    msg.reactions.map(r => ({
                        giverId: r.giverId,
                        receiverId: msg.authorId,
                        channelId: msg.channelId,
                        messageId: msg.id,
                        emoteName: r.emoteName,
                        emoteDiscordId: r.emoteDiscordId,
                    }))
                );

                console.log(`✅ Fetched reactions: ${allReactions.length} total reactions, ${allEmotes.length} emotes`);

                // Update cache with reactions
                await saveChannelFetchCache(channelId, {
                    discordMessages,
                    emotes: allEmotes,
                    fetchedAt: new Date().toISOString(),
                });
                const cachePath = fileManager.getCachePath(getChannelFetchCacheFilename(channelId));
                console.log(`💾 Updated cache with reactions: ${cachePath}`);
            } else {
                console.log(`✅ Loaded from cache: ${discordMessages.length} messages, ${allReactions.length} reactions, ${allEmotes.length} emotes`);
            }
        } else {
            // Fetch all messages from Discord
            console.log(`📥 Fetching messages from Discord for #${name}...`);
            const freshMessages = await fetchAllMessages(channel, endYear);

            // Save messages immediately to cache (before expensive reaction fetching)
            // This allows crash recovery - if reactions fail, we don't need to refetch messages
            const messagesWithoutReactions = freshMessages.map(msg => ({
                id: String(msg.id),
                authorId: String(msg.author.id),
                channelId: String(msg.channelId),
                content: msg.content,
                createdAt: msg.createdAt,
                editedAt: msg.editedAt,
                reactions: [], // Will be populated after reaction fetch
            }));

            await saveChannelFetchCache(channelId, {
                discordMessages: messagesWithoutReactions,
                emotes: [],
                fetchedAt: new Date().toISOString(),
            });
            console.log(`💾 Cached ${freshMessages.length} messages (reactions pending...)`);

            // Use the helper function to fetch reactions
            const allReactionDataByMessage = await fetchReactionsInBatches(freshMessages, name);

            // Build emote set (deduplicated)
            const emoteSet = new Map<string, { name: string; discordId: string }>();
            allReactionDataByMessage.forEach(data => {
                data.emotes.forEach(emote => {
                    const key = `${emote.name}:${emote.discordId}`;
                    emoteSet.set(key, emote);
                });
            });
            allEmotes = [...emoteSet.values()];

            // Build messages with embedded reactions
            discordMessages = freshMessages.map(msg => {
                const messageReactionData = allReactionDataByMessage.find(r => r.messageId === String(msg.id));

                return {
                    id: String(msg.id),
                    authorId: String(msg.author.id),
                    channelId: String(msg.channelId),
                    content: msg.content,
                    createdAt: msg.createdAt,
                    editedAt: msg.editedAt,
                    reactions: messageReactionData?.reactions || [],
                };
            });

            // Build full reaction list for database operations
            allReactions = discordMessages.flatMap(msg =>
                msg.reactions.map(r => ({
                    giverId: r.giverId,
                    receiverId: msg.authorId,
                    channelId: msg.channelId,
                    messageId: msg.id,
                    emoteName: r.emoteName,
                    emoteDiscordId: r.emoteDiscordId,
                }))
            );

            console.log(`✅ Fetched from Discord: ${discordMessages.length} messages, ${allReactions.length} reactions, ${allEmotes.length} emotes`);

            // Save everything to cache
            await saveChannelFetchCache(channelId, {
                discordMessages,
                emotes: allEmotes,
                fetchedAt: new Date().toISOString(),
            });
            const cachePath = fileManager.getCachePath(getChannelFetchCacheFilename(channelId));
            console.log(`💾 Saved to cache: ${cachePath}`);
        }

        // Get existing messages from database
        const existingMessagesArray = await messageRepository.getMessagesForChannel(channelId, endYear);
        const existingMessages = new Map(existingMessagesArray.map(m => [m.id, m]));

        const validDiscordMessageIds = new Set(discordMessages.map(m => m.id));
        const messagesToDelete = existingMessagesArray.filter(m => !validDiscordMessageIds.has(m.id)).map(m => m.id);

        // Batch create/fetch all unique emotes to minimize database round trips
        let emoteCache: Map<string, { id: number }> = new Map();
        if (allEmotes.length > 0) {
            emoteCache = await unitOfWork.execute(async repos => {
                return await repos.emoteRepository.batchFindOrCreate(allEmotes);
            });
        }

        // Categorize messages into new, updated, or unchanged
        const { messagesToCreate, messagesToUpdate } = discordMessages.reduce<{
            messagesToCreate: CreateMessageData[];
            messagesToUpdate: Array<{ id: string; content: string; editedAt: Date | null }>;
        }>(
            (acc, discordMessage) => {
                const messageId = discordMessage.id;
                const existingMsg = existingMessages.get(messageId);

                if (!existingMsg) {
                    return {
                        ...acc,
                        messagesToCreate: [
                            ...acc.messagesToCreate,
                            {
                                id: messageId,
                                authorId: discordMessage.authorId,
                                channelId: discordMessage.channelId,
                                content: discordMessage.content,
                                referencedMessageId: undefined, // Not stored in cache
                                createdAt: discordMessage.createdAt,
                                editedAt: discordMessage.editedAt,
                            },
                        ],
                    };
                }

                // Check if message was edited - compare both content and editedAt timestamp
                const contentChanged = existingMsg.content !== discordMessage.content;
                const editedAtChanged =
                    (existingMsg.editedAt === null && discordMessage.editedAt !== null) || (existingMsg.editedAt !== null && discordMessage.editedAt !== null && existingMsg.editedAt.getTime() !== discordMessage.editedAt.getTime());

                if (contentChanged || editedAtChanged) {
                    return {
                        ...acc,
                        messagesToUpdate: [
                            ...acc.messagesToUpdate,
                            {
                                id: messageId,
                                content: discordMessage.content,
                                editedAt: discordMessage.editedAt,
                            },
                        ],
                    };
                }

                return acc;
            },
            { messagesToCreate: [], messagesToUpdate: [] }
        );

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
        const existingReactions = [...existingMessages.values()].flatMap(m => m.reactions);

        const makeKey = (r: { giverId: string; receiverId: string; channelId: string; messageId: string; emoteId: number }) => `${r.giverId}:${r.receiverId}:${r.channelId}:${r.messageId}:${r.emoteId}`;

        const targetSet = new Set(targetReactions.map(makeKey));
        const existingSet = new Set(existingReactions.map(makeKey));

        const reactionsToAdd = targetReactions.filter(r => !existingSet.has(makeKey(r)));
        const reactionsToRemove = existingReactions.filter(r => !targetSet.has(makeKey(r)));

        // Execute batch operations with adaptive sizing
        // Delete messages first (this will cascade delete reactions)
        if (messagesToDelete.length > 0) {
            await Promise.all(messagesToDelete.map(id => messageRepository.delete({ id })));
            console.log(`🗑️ Deleted ${messagesToDelete.length} messages from #${name}`);
        }

        // Create messages: 7 params (id, authorId, channelId, content, referencedMessageId, createdAt, editedAt)
        await executeBatchWithAdaptiveSize(
            messagesToCreate,
            async batch => {
                await unitOfWork.execute(async repos => {
                    await repos.messageRepository.batchCreate(batch);
                });
            },
            `Create Messages (#${name})`,
            7
        );

        // Update messages: 3 params (id, content, editedAt)
        await executeBatchWithAdaptiveSize(
            messagesToUpdate,
            async batch => {
                await unitOfWork.execute(async repos => {
                    await repos.messageRepository.batchUpdate(batch);
                });
            },
            `Update Messages (#${name})`,
            3
        );

        // Delete reactions: 5 params (giverId, receiverId, channelId, messageId, emoteId)
        await executeBatchWithAdaptiveSize(
            reactionsToRemove,
            async batch => {
                await unitOfWork.execute(async repos => {
                    await repos.reactionRepository.batchDelete(batch);
                });
            },
            `Delete Reactions (#${name})`,
            5
        );

        // Create reactions: 5 params (giverId, receiverId, channelId, messageId, emoteId)
        await executeBatchWithAdaptiveSize(
            reactionsToAdd,
            async batch => {
                await unitOfWork.execute(async repos => {
                    await repos.reactionRepository.batchCreate(batch);
                });
            },
            `Create Reactions (#${name})`,
            5
        );

        // Log summary
        const changes = [
            messagesToCreate.length > 0 && `+${messagesToCreate.length} messages`,
            messagesToUpdate.length > 0 && `~${messagesToUpdate.length} updated`,
            messagesToDelete.length > 0 && `-${messagesToDelete.length} deleted`,
            reactionsToAdd.length > 0 && `+${reactionsToAdd.length} reactions`,
            reactionsToRemove.length > 0 && `-${reactionsToRemove.length} reactions`,
        ].filter(Boolean);

        if (changes.length > 0) {
            console.log(`✅ #${name}: ${changes.join(", ")}`);
        } else {
            console.log(`✅ #${name}: No changes`);
        }

        // Clear cache after successful sync so next run fetches fresh data
        // Cache persists during sync for crash recovery, but is removed on success
        await clearChannelFetchCache(channelId);
    }

    async function processAllChannels(guild: Guild, endYear?: number, channelIds?: string[], resume = false): Promise<void> {
        console.log(`💬 Begin processing messages in ${channelIds ? `${channelIds.length} specified channel(s)` : "all channels"} ${endYear ? `for ${endYear}` : "for all years"}`);
        await guild.channels.fetch();

        // Filter to text channels and optionally to specific channel IDs
        const textChannels = [...guild.channels.cache.values()].filter(c => c.type === ChannelType.GuildText).filter(c => !channelIds?.length || channelIds.includes(c.id)) as TextChannel[];

        // Load or initialize progress
        const guildId = String(guild.id);
        let progress: SyncProgress;
        const existingProgress = resume ? await loadProgress(guildId) : null;

        if (existingProgress) {
            console.log(`🔄 Resuming previous sync (${existingProgress.completedChannels.length}/${textChannels.length} channels completed)`);
            progress = existingProgress;
        } else {
            progress = {
                guildId,
                endYear,
                channelIds,
                completedChannels: [],
                startedAt: new Date().toISOString(),
                lastUpdatedAt: new Date().toISOString(),
            };
        }

        const processChannel = async (channel: TextChannel) => {
            if (progress.completedChannels.includes(channel.id)) {
                console.log(`⏭️ Skipping already completed channel: #${channel.name}`);
                return;
            }

            await syncChannel(channel, endYear);

            // Save progress after each channel
            progress.completedChannels.push(channel.id);
            await saveProgress(progress);
        };

        await Promise.all(textChannels.map(processChannel));

        // Clean up progress file on successful completion
        await clearProgress(guildId);
        console.log("💬 Finish processing all messages in all channels");
    }

    async function messageCreated(message: Message): Promise<void> {
        if (!validMessage(message)) {
            return;
        }

        if (message.partial) {
            await message.fetch();
        }

        try {
            const referencedMessageId = message.reference?.messageId ? String(message.reference.messageId) : undefined;
            const data: CreateMessageData = {
                id: String(message.id),
                authorId: String(message.author.id),
                channelId: String(message.channelId),
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

    async function messageDeleted(message: Message | PartialMessage): Promise<void> {
        if (!validMessage(message as Message)) {
            return;
        }

        if (message.partial) {
            await message.fetch();
        }

        try {
            await messageRepository.delete({ id: String(message.id) });
        } catch (e: unknown) {
            if (e instanceof Error && e.message === "Message does not exist") {
                return;
            }
            console.error("Error removing message from database", e, message.content);
        }
    }

    async function messageEdited(_oldMessage: Message | PartialMessage, newMessage: Message): Promise<void> {
        if (!validMessage(newMessage)) {
            return;
        }

        if (newMessage.partial) {
            await newMessage.fetch();
        }

        try {
            await messageRepository.edit({
                id: String(newMessage.id),
                content: newMessage.content,
                editedAt: newMessage.editedAt,
            });
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
        messageCreated,
        messageDeleted,
        messageEdited,
        getAllDBMessages,
        getNewestDBMessages,
        hasAnyMessages,
    };
};
