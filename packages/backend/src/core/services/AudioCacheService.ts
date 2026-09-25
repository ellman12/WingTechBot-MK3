import type { Config } from "@core/config/Config.js";
import type { AudioFormatInfo } from "@core/entities/AudioFormatInfo.js";
import type { AudioStreamWithMetadata } from "@core/entities/AudioStream.js";
import type { AudioCacheStore } from "@core/ports/repositories/AudioCacheStore.js";
import crypto from "crypto";

export type AudioCacheService = {
    readonly getCached: (url: string) => Promise<AudioStreamWithMetadata | null>;
    readonly saveToCache: (url: string, audioData: Uint8Array, formatInfo?: AudioFormatInfo) => Promise<void>;
    readonly cleanExpired: () => Promise<void>;
};

export type AudioCacheServiceDeps = {
    readonly audioCacheStore: AudioCacheStore;
    readonly config: Config;
};

export const createAudioCacheService = ({ audioCacheStore, config }: AudioCacheServiceDeps): AudioCacheService => {
    const ttlMs = config.cache.ttlHours * 60 * 60 * 1000;
    const maxSizeBytes = config.cache.maxSizeMb * 1024 * 1024;

    console.log(`[AudioCacheService] Creating cache service with TTL: ${config.cache.ttlHours}h, Max Size: ${config.cache.maxSizeMb}MB`);

    // Generate a cache key from a URL
    // For YouTube URLs, extract the video ID
    // For other URLs, hash the URL
    const generateCacheKey = (url: string): string => {
        // Extract YouTube video ID
        const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (youtubeMatch) {
            return `yt_${youtubeMatch[1]}`;
        }

        // For other URLs, create a hash
        const hash = crypto.createHash("sha256").update(url).digest("hex");
        return `url_${hash.substring(0, 16)}`;
    };

    const isExpired = (cachedAt: Date, now = Date.now()): boolean => now - cachedAt.getTime() > ttlMs;

    // Return the cached audio if present and not expired
    const getCached = async (url: string): Promise<AudioStreamWithMetadata | null> => {
        const key = generateCacheKey(url);

        try {
            const entry = await audioCacheStore.stat(key);
            if (!entry) {
                console.log(`[AudioCacheService] Cache miss for: ${url}`);
                return null;
            }

            if (isExpired(entry.cachedAt)) {
                const age = Date.now() - entry.cachedAt.getTime();
                console.log(`[AudioCacheService] Cache expired for: ${url} (age: ${Math.round(age / 1000 / 60)}min, ttl: ${config.cache.ttlHours}h)`);
                await audioCacheStore.delete(key).catch(() => {
                    // Ignore cleanup errors
                });
                return null;
            }

            const cached = await audioCacheStore.read(key);
            if (cached.formatInfo) {
                console.log(`[AudioCacheService] Loaded formatInfo for ${url}:`, cached.formatInfo);
            } else {
                console.log(`[AudioCacheService] No format info cached for ${url}, format will be auto-detected`);
            }

            console.log(`[AudioCacheService] Cache hit for: ${url}`);
            return cached;
        } catch (error) {
            console.error(`[AudioCacheService] Error reading cache:`, error);
            return null;
        }
    };

    // Save audio data to cache with format information
    const saveToCache = async (url: string, audioData: Uint8Array, formatInfo?: AudioFormatInfo): Promise<void> => {
        const key = generateCacheKey(url);

        try {
            // Clean up expired entries
            await cleanExpired();

            // Save the audio data to the cache
            console.log(`[AudioCacheService] Saving to cache: ${url} -> ${key}`, formatInfo ?? "");
            await audioCacheStore.write(key, audioData, formatInfo);
            console.log(`[AudioCacheService] Successfully cached: ${url}`);

            // Evict oldest entries if cache size exceeds limit
            await evictIfNeeded();
        } catch (error) {
            console.error(`[AudioCacheService] Error saving to cache:`, error);
            // Don't throw - caching failure shouldn't break the download
        }
    };

    // Clean up expired cache entries
    const cleanExpired = async (): Promise<void> => {
        try {
            console.log(`[AudioCacheService] Starting cache cleanup`);

            const now = Date.now();
            const expired = (await audioCacheStore.list()).filter(entry => isExpired(entry.cachedAt, now));
            const results = await Promise.allSettled(expired.map(entry => audioCacheStore.delete(entry.key)));

            results.forEach((result, i) => {
                if (result.status === "rejected") {
                    console.error(`[AudioCacheService] Error cleaning cache entry ${expired[i]!.key}:`, result.reason);
                }
            });

            const cleanedCount = results.filter(result => result.status === "fulfilled").length;
            console.log(`[AudioCacheService] Cache cleanup complete. Removed ${cleanedCount} expired entries.`);
        } catch (error) {
            console.error(`[AudioCacheService] Error during cache cleanup:`, error);
        }
    };

    // Evict oldest cache entries if total size exceeds the limit
    // Entries are evicted based on oldest cachedAt (shortest TTL remaining)
    const evictIfNeeded = async (): Promise<void> => {
        try {
            const entries = await audioCacheStore.list();
            const totalSize = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);

            console.log(`[AudioCacheService] Current cache size: ${(totalSize / 1024 / 1024).toFixed(2)}MB / ${config.cache.maxSizeMb}MB`);

            if (totalSize <= maxSizeBytes) {
                console.log(`[AudioCacheService] Cache size within limit, no eviction needed`);
                return;
            }

            const oldestFirst = [...entries].sort((a, b) => a.cachedAt.getTime() - b.cachedAt.getTime());

            let evictedCount = 0;
            let evictedSize = 0;

            // Evict oldest entries until we're under the limit
            for (const entry of oldestFirst) {
                if (totalSize - evictedSize <= maxSizeBytes) {
                    break;
                }

                try {
                    await audioCacheStore.delete(entry.key);
                    evictedSize += entry.sizeBytes;
                    evictedCount++;
                    console.log(`[AudioCacheService] Evicted: ${entry.key} (${(entry.sizeBytes / 1024 / 1024).toFixed(2)}MB)`);
                } catch (error) {
                    console.error(`[AudioCacheService] Error evicting entry ${entry.key}:`, error);
                }
            }

            console.log(`[AudioCacheService] Eviction complete. Removed ${evictedCount} entries (${(evictedSize / 1024 / 1024).toFixed(2)}MB). New size: ${((totalSize - evictedSize) / 1024 / 1024).toFixed(2)}MB`);
        } catch (error) {
            console.error(`[AudioCacheService] Error during cache eviction:`, error);
        }
    };

    return {
        getCached,
        saveToCache,
        cleanExpired,
    };
};
