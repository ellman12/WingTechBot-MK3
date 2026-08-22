import type { RegisterEventHandler } from "@application/discord/EventRegistrar.js";
import type { CreateMessageData } from "@core/entities/Message.js";
import type { ReactionEmoteRef } from "@core/entities/ReactionEmote.js";
import type { FileManager } from "@core/ports/services/FileManager.js";
import type { ChannelSnapshotReaction, ChannelSnapshotSummary, MessageArchiveService } from "@core/services/MessageArchiveService.js";
import { ChannelType, Events, type Guild, type Message, MessageFlags, type PartialMessage, type TextChannel } from "discord.js";
import pRetry from "p-retry";

export type MessageSync = {
    readonly processAllChannels: (guild: Guild, endYear?: number, channelIds?: string[], resume?: boolean) => Promise<void>;

    readonly syncChannel: (channel: TextChannel, endYear?: number) => Promise<void>;

    readonly messageCreated: (message: Message) => Promise<void>;

    readonly messageDeleted: (message: Message | PartialMessage) => Promise<void>;

    readonly messageEdited: (oldMessage: Message | PartialMessage, newMessage: Message) => Promise<void>;
};

export type MessageSyncDeps = {
    messageArchiveService: MessageArchiveService;
    fileManager: FileManager;
};

type SyncProgress = {
    guildId: string;
    endYear?: number;
    channelIds?: string[];
    completedChannels: string[];
    startedAt: string;
    lastUpdatedAt: string;
};

type CachedReaction = { giverId: string; receiverId: string; channelId: string; messageId: string; emoteName: string; emoteDiscordId: string };

type CachedMessage = {
    id: string;
    authorId: string;
    channelId: string;
    content: string;
    createdAt: Date;
    editedAt: Date | null;
    reactions: CachedReaction[];
};

type ChannelFetchCache = {
    reactionFetchState?: {
        processedMessageIndex?: number;
        reactionsFetched?: number;
    };
    discordMessages: CachedMessage[];
    emotes: ReactionEmoteRef[];
    fetchedAt: string;
};

type ReactionData = {
    messageId: string;
    reactions: CachedReaction[];
    emotes: ReactionEmoteRef[];
};

// Helper function to retry Discord API calls that may fail with network errors like EAI_AGAIN
async function retryDiscordFetch<T>(fn: () => Promise<T>, context: string): Promise<T> {
    return pRetry(fn, {
        retries: 3,
        minTimeout: 1000, // Start with 1 second
        maxTimeout: 5000, // Max 5 seconds between retries
        factor: 2, // Exponential backoff factor
        onFailedAttempt: error => {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`[MessageSync] ${context} failed (attempt ${error.attemptNumber}/${error.retriesLeft + error.attemptNumber}): ${errorMessage}`);
        },
    });
}

// Collects reaction data for batch processing to minimize database round trips.
async function collectReactionData(discordMessage: Message): Promise<{ emotes: ReactionEmoteRef[]; reactions: CachedReaction[] }> {
    const messageId = String(discordMessage.id);
    const authorId = String(discordMessage.author.id);
    const channelId = String(discordMessage.channelId);

    const reactionResults = await Promise.all(
        [...discordMessage.reactions.cache.values()].map(async reaction => {
            try {
                const name = reaction.emoji.name!;
                const emoteDiscordId = reaction.emoji.id ?? "";

                await retryDiscordFetch(() => reaction.users.fetch(), `Fetching users for reaction ${name} on message ${messageId}`);
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
                        console.log(`[MessageSync] Skipping reactions for deleted message: ${messageId}`);
                        return { reactions: [], emote: null };
                    }

                    if (apiError.code === 10014) {
                        console.log(`[MessageSync] Skipping reactions for deleted emoji: ${reaction.emoji.id}, ${reaction.emoji.name}`);
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
        .filter((e): e is ReactionEmoteRef => e !== null)
        .filter((emote, index, self) => self.findIndex(e => e.name === emote.name && e.discordId === emote.discordId) === index);

    return { emotes, reactions };
}

function validMessage(message: Message): boolean {
    return message.channel.type !== ChannelType.DM && !message.flags.has(MessageFlags.Ephemeral);
}

//Discord message → the plain shape kept in the fetch cache.
const mapDiscordMessage = (message: Message): CachedMessage => ({
    id: String(message.id),
    authorId: String(message.author.id),
    channelId: String(message.channelId),
    content: message.content,
    createdAt: message.createdAt,
    editedAt: message.editedAt,
    reactions: [],
});

//Cached message → what the archive stores. referencedMessageId is not kept in the cache.
const toCreateMessageData = (message: CachedMessage): CreateMessageData => ({
    id: message.id,
    authorId: message.authorId,
    channelId: message.channelId,
    content: message.content,
    referencedMessageId: undefined,
    createdAt: message.createdAt,
    editedAt: message.editedAt,
});

const buildReactionList = (messages: CachedMessage[]): ChannelSnapshotReaction[] =>
    messages.flatMap(msg =>
        msg.reactions.map(r => ({
            giverId: r.giverId,
            receiverId: r.receiverId,
            channelId: msg.channelId,
            messageId: msg.id,
            emote: { name: r.emoteName, discordId: r.emoteDiscordId },
        }))
    );

const chunkArray = <T>(items: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};

const uniqueEmotes = (reactionData: ReactionData[]): ReactionEmoteRef[] => {
    const emoteSet = new Map<string, ReactionEmoteRef>();
    reactionData.forEach(data => {
        data.emotes.forEach(emote => emoteSet.set(`${emote.name}:${emote.discordId}`, emote));
    });
    return [...emoteSet.values()];
};

const logSyncSummary = (channelName: string, summary: ChannelSnapshotSummary): void => {
    const changes = [
        summary.created > 0 && `+${summary.created} messages`,
        summary.updated > 0 && `~${summary.updated} updated`,
        summary.deleted > 0 && `-${summary.deleted} deleted`,
        summary.reactionsCreated > 0 && `+${summary.reactionsCreated} reactions`,
        summary.reactionsDeleted > 0 && `-${summary.reactionsDeleted} reactions`,
    ].filter(Boolean);

    if (changes.length > 0) {
        console.log(`✅ #${channelName}: ${changes.join(", ")}`);
    } else {
        console.log(`✅ #${channelName}: No changes`);
    }
};

export const createMessageSync = ({ messageArchiveService, fileManager }: MessageSyncDeps): MessageSync => {
    console.log("[MessageSync] Creating message sync");

    const getChannelFetchCacheFilename = (channelId: string) => `channel-fetch-cache-${channelId}.json`;

    async function loadChannelFetchCache(channelId: string): Promise<ChannelFetchCache | null> {
        const cached = await fileManager.readCache<ChannelFetchCache>(getChannelFetchCacheFilename(channelId));
        if (!cached) return null;

        return {
            ...cached,
            discordMessages: cached.discordMessages.map(msg => ({
                ...msg,
                createdAt: new Date(msg.createdAt),
                editedAt: msg.editedAt ? new Date(msg.editedAt) : null,
            })),
        };
    }

    async function saveChannelFetchCache(channelId: string, cache: ChannelFetchCache): Promise<void> {
        await fileManager.writeCache(getChannelFetchCacheFilename(channelId), cache);
    }

    async function clearChannelFetchCache(channelId: string): Promise<void> {
        await fileManager.deleteCache(getChannelFetchCacheFilename(channelId));
    }

    const getProgressFilename = (guildId: string) => `sync-progress-${guildId}.json`;

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

    // Generic helper to fetch reactions in batches with progress tracking and periodic persistence
    async function fetchReactionsWithResume<T>(items: T[], channelId: string, fetchReactionsFn: (item: T) => Promise<ReactionData>, createCacheFn: () => ChannelFetchCache): Promise<ReactionData[]> {
        const REACTION_PROGRESS_INTERVAL = 500;
        const REACTION_PERSIST_INTERVAL = 100;
        const PARALLEL_BATCH_SIZE = 10;

        const cached = (await loadChannelFetchCache(channelId)) ?? createCacheFn();

        const startIndex = cached.reactionFetchState?.processedMessageIndex ?? 0;
        if (startIndex >= items.length) {
            return [];
        }

        const remainingItems = items.slice(startIndex);
        const remainingBatches = chunkArray(remainingItems, PARALLEL_BATCH_SIZE);
        const emoteSet = new Map<string, ReactionEmoteRef>(cached.emotes.map(e => [`${e.name}:${e.discordId}`, e]));

        let reactionsSinceLastPersist = 0;
        let totalReactionsFetched = cached.reactionFetchState?.reactionsFetched ?? 0;

        const { data } = await remainingBatches.reduce<Promise<{ data: ReactionData[]; total: number }>>(
            async (accPromise, batch, batchIndex) => {
                const acc = await accPromise;
                const batchResults = await Promise.all(batch.map(fetchReactionsFn));

                batchResults.forEach(res => {
                    const cachedMsg = cached.discordMessages.find(cm => cm.id === res.messageId);
                    if (cachedMsg) {
                        cachedMsg.reactions = res.reactions;
                    }
                    res.emotes.forEach(e => emoteSet.set(`${e.name}:${e.discordId}`, e));
                });

                const batchReactionsCount = batchResults.reduce((sum, r) => sum + r.reactions.length, 0);
                totalReactionsFetched += batchReactionsCount;
                reactionsSinceLastPersist += batchReactionsCount;
                const processedMessages = Math.min(startIndex + Math.min((batchIndex + 1) * PARALLEL_BATCH_SIZE, remainingItems.length), items.length);

                if (totalReactionsFetched > 0 && (totalReactionsFetched % REACTION_PROGRESS_INTERVAL === 0 || processedMessages === items.length)) {
                    console.log(`⚡ Progress: ${totalReactionsFetched} reactions from ${processedMessages}/${items.length} messages`);
                }

                if (reactionsSinceLastPersist >= REACTION_PERSIST_INTERVAL || processedMessages === items.length) {
                    cached.emotes = [...emoteSet.values()].sort((a, b) => `${a.name}:${a.discordId}`.localeCompare(`${b.name}:${b.discordId}`));
                    cached.fetchedAt = new Date().toISOString();
                    cached.reactionFetchState = {
                        processedMessageIndex: processedMessages,
                        reactionsFetched: totalReactionsFetched,
                    };

                    await saveChannelFetchCache(channelId, cached);
                    const cachePath = fileManager.getCachePath(getChannelFetchCacheFilename(channelId));
                    console.log(`💾 Persisted reactions progress to cache: ${cachePath} (reactions=${totalReactionsFetched}, processedMessages=${processedMessages})`);

                    reactionsSinceLastPersist = 0;
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

    // Wrapper around fetchReactionsWithResume for fetching reactions from fresh Discord Message objects
    async function fetchReactionsInBatches(messages: Message[], channelName: string, channelId: string): Promise<ReactionData[]> {
        console.log(`⚡ Fetching reactions for ${messages.length} messages from #${channelName}...`);
        return fetchReactionsWithResume(
            messages,
            channelId,
            async msg => {
                const { reactions, emotes } = await collectReactionData(msg);
                return { messageId: String(msg.id), reactions, emotes };
            },
            () => ({
                reactionFetchState: { processedMessageIndex: 0, reactionsFetched: 0 },
                discordMessages: messages.map(mapDiscordMessage),
                emotes: [],
                fetchedAt: new Date().toISOString(),
            })
        );
    }

    // Wrapper around fetchReactionsWithResume for refetching reactions from cached message IDs
    async function fetchReactionsForCachedMessages(channel: TextChannel, cachedMessages: CachedMessage[], channelName: string, channelId: string): Promise<ReactionData[]> {
        console.log(`⚡ Fetching reactions for ${cachedMessages.length} cached messages from #${channelName}...`);
        return fetchReactionsWithResume(
            cachedMessages,
            channelId,
            async cachedMsg => {
                try {
                    const msg = await retryDiscordFetch(() => channel.messages.fetch(cachedMsg.id), `Fetching message ${cachedMsg.id} from #${channelName}`);
                    const { reactions, emotes } = await collectReactionData(msg);
                    return { messageId: cachedMsg.id, reactions, emotes };
                } catch (error: unknown) {
                    if (error && typeof error === "object" && "code" in error && (error as { code: number }).code === 10008) {
                        return { messageId: cachedMsg.id, reactions: [], emotes: [] };
                    }
                    throw error;
                }
            },
            () => ({
                reactionFetchState: { processedMessageIndex: 0, reactionsFetched: 0 },
                discordMessages: cachedMessages.map(m => ({ ...m })),
                emotes: [],
                fetchedAt: new Date().toISOString(),
            })
        );
    }

    async function fetchAllMessages(channel: TextChannel, endYear?: number): Promise<Message[]> {
        const PROGRESS_INTERVAL = 5000;

        const fetchBatch = async (beforeId: string | null = null): Promise<{ messages: Message[]; hasMore: boolean }> => {
            const options = { limit: 100, ...(beforeId && { before: beforeId }) };
            const messages = await retryDiscordFetch(() => channel.messages.fetch(options), `Fetching message batch from #${channel.name}${beforeId ? ` before ${beforeId}` : ""}`);

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

    // Cache had messages but incomplete (or missing) reactions, so fetch the reactions for the cached message ids.
    async function completeCachedReactions(channel: TextChannel, cachedFetch: ChannelFetchCache): Promise<{ discordMessages: CachedMessage[]; emotes: ReactionEmoteRef[] }> {
        const name = channel.name;
        const channelId = String(channel.id);

        const isResume = (cachedFetch.reactionFetchState?.processedMessageIndex ?? 0) > 0;
        console.log(
            isResume ? `⚠️ Cache has incomplete reactions (${cachedFetch.reactionFetchState?.processedMessageIndex}/${cachedFetch.discordMessages.length} processed), resuming...` : `⚠️ Cache has messages but no reactions, fetching reactions now...`
        );

        // Fetch reactions only for the cached message IDs instead of re-fetching all messages
        const allReactionDataByMessage = await fetchReactionsForCachedMessages(channel, cachedFetch.discordMessages, name, channelId);
        const emotes = uniqueEmotes(allReactionDataByMessage);

        // Update messages with reactions
        const discordMessages = cachedFetch.discordMessages.map(msg => {
            const messageReactionData = allReactionDataByMessage.find(r => r.messageId === msg.id);
            return { ...msg, reactions: messageReactionData?.reactions || [] };
        });

        console.log(`✅ Fetched reactions: ${buildReactionList(discordMessages).length} total reactions, ${emotes.length} emotes`);

        // Update cache with reactions
        await saveChannelFetchCache(channelId, { discordMessages, emotes, fetchedAt: new Date().toISOString() });
        const cachePath = fileManager.getCachePath(getChannelFetchCacheFilename(channelId));
        console.log(`💾 Updated cache with reactions: ${cachePath}`);

        return { discordMessages, emotes };
    }

    async function useCachedChannelData(channel: TextChannel, cachedFetch: ChannelFetchCache): Promise<{ discordMessages: CachedMessage[]; emotes: ReactionEmoteRef[] }> {
        const name = channel.name;
        console.log(`📦 Using cached data for #${name} (${cachedFetch.discordMessages.length} messages from ${cachedFetch.fetchedAt})`);

        const reactionCount = buildReactionList(cachedFetch.discordMessages).length;

        // Check if we need to fetch reactions (cache might only have messages or be incomplete)
        const needsReactionFetch = (reactionCount === 0 && cachedFetch.emotes.length === 0) || (cachedFetch.reactionFetchState?.processedMessageIndex ?? cachedFetch.discordMessages.length) < cachedFetch.discordMessages.length;

        if (needsReactionFetch) {
            return await completeCachedReactions(channel, cachedFetch);
        }

        console.log(`✅ Loaded from cache: ${cachedFetch.discordMessages.length} messages, ${reactionCount} reactions, ${cachedFetch.emotes.length} emotes`);
        return { discordMessages: cachedFetch.discordMessages, emotes: cachedFetch.emotes };
    }

    async function fetchChannelDataFromDiscord(channel: TextChannel, endYear?: number): Promise<{ discordMessages: CachedMessage[]; emotes: ReactionEmoteRef[] }> {
        const name = channel.name;
        const channelId = String(channel.id);

        console.log(`📥 Fetching messages from Discord for #${name}...`);
        const freshMessages = await fetchAllMessages(channel, endYear);

        // Save messages immediately to cache (before expensive reaction fetching)
        // This allows crash recovery - if reactions fail, we don't need to refetch messages
        const messagesWithoutReactions = freshMessages.map(mapDiscordMessage);

        await saveChannelFetchCache(channelId, { discordMessages: messagesWithoutReactions, emotes: [], fetchedAt: new Date().toISOString() });
        console.log(`💾 Cached ${freshMessages.length} messages (reactions pending...)`);

        const allReactionDataByMessage = await fetchReactionsInBatches(freshMessages, name, channelId);
        const emotes = uniqueEmotes(allReactionDataByMessage).sort((a, b) => `${a.name}:${a.discordId}`.localeCompare(`${b.name}:${b.discordId}`));

        // Build messages with embedded reactions
        const discordMessages = messagesWithoutReactions.map(msg => {
            const messageReactionData = allReactionDataByMessage.find(r => r.messageId === msg.id);
            return { ...msg, reactions: messageReactionData?.reactions || [] };
        });

        console.log(`✅ Fetched from Discord: ${discordMessages.length} messages, ${buildReactionList(discordMessages).length} reactions, ${emotes.length} emotes`);

        // Save everything to cache
        await saveChannelFetchCache(channelId, { discordMessages, emotes, fetchedAt: new Date().toISOString() });
        const cachePath = fileManager.getCachePath(getChannelFetchCacheFilename(channelId));
        console.log(`💾 Saved to cache: ${cachePath}`);

        return { discordMessages, emotes };
    }

    // Syncs a single channel: fetches everything it currently contains and lets the archive reconcile the database.
    async function syncChannel(channel: TextChannel, endYear?: number): Promise<void> {
        const name = channel.name;
        const channelId = String(channel.id);
        console.log(`🗨️ Begin syncing #${name}`);

        const cachedFetch = await loadChannelFetchCache(channelId);
        const { discordMessages, emotes } = cachedFetch ? await useCachedChannelData(channel, cachedFetch) : await fetchChannelDataFromDiscord(channel, endYear);

        const summary = await messageArchiveService.syncChannelSnapshot({
            channelId,
            channelName: name,
            endYear,
            messages: discordMessages.map(toCreateMessageData),
            reactions: buildReactionList(discordMessages),
            emotes,
        });

        logSyncSummary(name, summary);

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
        const existingProgress = resume ? await loadProgress(guildId) : null;

        if (existingProgress) {
            console.log(`🔄 Resuming previous sync (${existingProgress.completedChannels.length}/${textChannels.length} channels completed)`);
        }

        const progress: SyncProgress = existingProgress ?? {
            guildId,
            endYear,
            channelIds,
            completedChannels: [],
            startedAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
        };

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

        await messageArchiveService.archiveMessage({
            id: String(message.id),
            authorId: String(message.author.id),
            channelId: String(message.channelId),
            content: message.content,
            referencedMessageId: message.reference?.messageId ? String(message.reference.messageId) : undefined,
            createdAt: message.createdAt,
            editedAt: message.editedAt,
        });
    }

    async function messageDeleted(message: Message | PartialMessage): Promise<void> {
        if (!validMessage(message as Message)) {
            return;
        }

        if (message.partial) {
            await message.fetch();
        }

        await messageArchiveService.deleteMessage(String(message.id));
    }

    async function messageEdited(_oldMessage: Message | PartialMessage, newMessage: Message): Promise<void> {
        if (!validMessage(newMessage)) {
            return;
        }

        if (newMessage.partial) {
            await newMessage.fetch();
        }

        await messageArchiveService.editMessage({
            id: String(newMessage.id),
            content: newMessage.content,
            editedAt: newMessage.editedAt,
        });
    }

    return {
        processAllChannels,
        syncChannel,
        messageCreated,
        messageDeleted,
        messageEdited,
    };
};

export const registerMessageSyncEvents = (messageSync: MessageSync, registerEventHandler: RegisterEventHandler): void => {
    registerEventHandler(Events.MessageCreate, messageSync.messageCreated);
    registerEventHandler(Events.MessageDelete, messageSync.messageDeleted);
    registerEventHandler(Events.MessageUpdate, messageSync.messageEdited);
};
