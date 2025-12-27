import type { AudioFormatInfo } from "@core/entities/AudioFormatInfo.js";
import type { AudioStreamWithMetadata } from "@core/entities/AudioStream.js";
import { createAudioStreamWithFormat } from "@core/entities/AudioStream.js";
import type { Config } from "@infrastructure/config/Config.js";
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

    console.log(`[AudioCacheService] Creating cache service with path: ${cachePath}, TTL: ${config.cache.ttlHours}h`);

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

    return {
        getCached,
        saveToCache,
        cleanExpired,
    };
};
