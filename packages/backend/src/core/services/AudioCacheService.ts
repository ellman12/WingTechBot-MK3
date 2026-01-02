import type { Config } from "@core/config/Config.js";
import type { AudioFormatInfo } from "@core/entities/AudioFormatInfo.js";
import type { AudioStreamWithMetadata } from "@core/entities/AudioStream.js";
import { createAudioStreamWithFormat } from "@core/entities/AudioStream.js";
import crypto from "crypto";
import { Readable } from "stream";

import type { FileManager } from "./FileManager.js";

export type AudioCacheMetadata = {
    readonly formatInfo?: AudioFormatInfo;
    readonly cachedAt: number;
};

export type AudioCacheService = {
    readonly getCached: (url: string) => Promise<AudioStreamWithMetadata | null>;
    readonly saveToCache: (url: string, audioData: Uint8Array, formatInfo?: AudioFormatInfo) => Promise<void>;
    readonly cleanExpired: () => Promise<void>;
};

export type AudioCacheServiceDeps = {
    readonly fileManager: FileManager;
    readonly config: Config;
};

export const createAudioCacheService = ({ fileManager, config }: AudioCacheServiceDeps): AudioCacheService => {
    const cachePath = config.cache.audioDownloadPath;
    const ttlMs = config.cache.ttlHours * 60 * 60 * 1000;
    const maxSizeBytes = config.cache.maxSizeMb * 1024 * 1024;

    console.log(`[AudioCacheService] Creating cache service with path: ${cachePath}, TTL: ${config.cache.ttlHours}h, Max Size: ${config.cache.maxSizeMb}MB`);

    /**
     * Generate a cache key from a URL
     * For YouTube URLs, extract the video ID
     * For other URLs, hash the URL
     */
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

    /**
     * Get the full cache file path for a URL
     */
    const getCacheFilePath = (url: string): string => {
        const key = generateCacheKey(url);
        return `${cachePath}/${key}.cache`;
    };

    /**
     * Get the metadata file path for a cached audio file
     */
    const getMetadataFilePath = (url: string): string => {
        const key = generateCacheKey(url);
        return `${cachePath}/${key}.meta.json`;
    };

    /**
     * Check if cache file exists and is not expired
     */
    const getCached = async (url: string): Promise<AudioStreamWithMetadata | null> => {
        const filePath = getCacheFilePath(url);
        const metadataPath = getMetadataFilePath(url);

        try {
            const exists = await fileManager.fileExists(filePath);
            if (!exists) {
                console.log(`[AudioCacheService] Cache miss for: ${url}`);
                return null;
            }

            // Check if cache is expired by reading file stats
            const stats = await fileManager.getFileStats(filePath);
            const age = Date.now() - stats.mtime.getTime();
            if (age > ttlMs) {
                console.log(`[AudioCacheService] Cache expired for: ${url} (age: ${Math.round(age / 1000 / 60)}min, ttl: ${config.cache.ttlHours}h)`);
                // Clean up expired cache and metadata
                try {
                    await fileManager.deleteFile(filePath);
                    await fileManager.deleteFile(metadataPath);
                } catch {
                    // Ignore cleanup errors
                }
                return null;
            }

            // Try to read metadata
            let formatInfo: AudioFormatInfo | undefined;

            try {
                const metadataExists = await fileManager.fileExists(metadataPath);
                if (metadataExists) {
                    const metadataContent = await fileManager.readFile(metadataPath);
                    const metadata: AudioCacheMetadata = JSON.parse(metadataContent.toString());
                    formatInfo = metadata.formatInfo;

                    if (formatInfo) {
                        console.log(`[AudioCacheService] Loaded formatInfo for ${url}:`, formatInfo);
                    }
                } else {
                    console.log(`[AudioCacheService] No metadata file found for ${url}, format will be auto-detected`);
                }
            } catch (metadataError) {
                console.warn(`[AudioCacheService] Failed to read metadata for ${url}:`, metadataError);
                // Continue without metadata - FFmpeg will try to auto-detect
            }

            console.log(`[AudioCacheService] Cache hit for: ${url}`);
            const stream = fileManager.readStream(filePath);

            if (formatInfo) {
                return createAudioStreamWithFormat(stream, formatInfo);
            } else {
                return { stream };
            }
        } catch (error) {
            console.error(`[AudioCacheService] Error reading cache:`, error);
            return null;
        }
    };

    /**
     * Save audio data to cache with format information
     */
    const saveToCache = async (url: string, audioData: Uint8Array, formatInfo?: AudioFormatInfo): Promise<void> => {
        const filePath = getCacheFilePath(url);
        const metadataPath = getMetadataFilePath(url);

        try {
            console.log(`[AudioCacheService] Saving to cache: ${url} -> ${filePath}`);
            const stream = Readable.from(audioData);
            await fileManager.writeStream(filePath, stream);

            if (formatInfo) {
                const metadata: AudioCacheMetadata = {
                    formatInfo,
                    cachedAt: Date.now(),
                };

                console.log(`[AudioCacheService] Saving metadata: ${url} -> ${metadataPath}`, metadata);
                await fileManager.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
            }

            console.log(`[AudioCacheService] Successfully cached: ${url}`);

            // Evict oldest files if cache size exceeds limit
            await evictIfNeeded();
        } catch (error) {
            console.error(`[AudioCacheService] Error saving to cache:`, error);
            // Don't throw - caching failure shouldn't break the download
        }
    };

    /**
     * Clean up expired cache entries
     */
    const cleanExpired = async (): Promise<void> => {
        try {
            console.log(`[AudioCacheService] Starting cache cleanup`);

            const cacheFiles = await fileManager.listFiles(cachePath);
            const now = Date.now();
            // Run clean-up of expired files in parallel for speed
            const expiredChecks = cacheFiles.map(async file => {
                try {
                    const stats = await fileManager.getFileStats(file);
                    if (now - stats.mtime.getTime() > ttlMs) {
                        await fileManager.deleteFile(file);
                        return 1;
                    }
                } catch (error) {
                    console.error(`[AudioCacheService] Error cleaning cache file ${file}:`, error);
                }
                return 0;
            });

            const cleanedCounts = await Promise.all(expiredChecks);
            const cleanedCount = cleanedCounts.reduce((a: number, b: number) => a + b, 0);

            console.log(`[AudioCacheService] Cache cleanup complete. Removed ${cleanedCount} expired entries.`);
        } catch (error) {
            console.error(`[AudioCacheService] Error during cache cleanup:`, error);
        }
    };

    /**
     * Evict oldest cache files if total size exceeds the limit
     * Files are evicted based on oldest mtime (shortest TTL remaining)
     */
    const evictIfNeeded = async (): Promise<void> => {
        try {
            const cacheFiles = await fileManager.listFiles(cachePath);

            // Calculate total cache size
            let totalSize = 0;
            const fileStats: Array<{ path: string; size: number; mtime: number }> = [];

            for (const file of cacheFiles) {
                try {
                    const stats = await fileManager.getFileStats(file);
                    totalSize += stats.size;
                    fileStats.push({
                        path: file,
                        size: stats.size,
                        mtime: stats.mtime.getTime(),
                    });
                } catch (error) {
                    console.error(`[AudioCacheService] Error getting stats for ${file}:`, error);
                }
            }

            console.log(`[AudioCacheService] Current cache size: ${(totalSize / 1024 / 1024).toFixed(2)}MB / ${config.cache.maxSizeMb}MB`);

            if (totalSize <= maxSizeBytes) {
                console.log(`[AudioCacheService] Cache size within limit, no eviction needed`);
                return;
            }

            // Sort files by mtime (oldest first - shortest TTL remaining)
            fileStats.sort((a, b) => a.mtime - b.mtime);

            let evictedCount = 0;
            let evictedSize = 0;

            // Evict oldest files until we're under the limit
            for (const file of fileStats) {
                if (totalSize - evictedSize <= maxSizeBytes) {
                    break;
                }

                try {
                    await fileManager.deleteFile(file.path);
                    evictedSize += file.size;
                    evictedCount++;
                    console.log(`[AudioCacheService] Evicted: ${file.path} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
                } catch (error) {
                    console.error(`[AudioCacheService] Error evicting file ${file.path}:`, error);
                }
            }

            console.log(`[AudioCacheService] Eviction complete. Removed ${evictedCount} files (${(evictedSize / 1024 / 1024).toFixed(2)}MB). New size: ${((totalSize - evictedSize) / 1024 / 1024).toFixed(2)}MB`);
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
