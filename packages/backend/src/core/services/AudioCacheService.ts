import type { Config } from "@core/config/Config.js";
import type { AudioFormatInfo } from "@core/entities/AudioFormatInfo.js";
import type { AudioStreamWithMetadata } from "@core/entities/AudioStream.js";
import { createAudioStreamWithFormat } from "@core/entities/AudioStream.js";
import type { FileManager } from "@core/ports/services/FileManager.js";
import crypto from "crypto";
import path from "path";
import { Readable } from "stream";

export type AudioCacheMetadata = {
    readonly formatInfo?: AudioFormatInfo;
    readonly cachedAt: number;
};

export type AudioCacheService = {
    readonly getCached: (url: string) => Promise<AudioStreamWithMetadata | null>;
    readonly saveToCache: (url: string, audioData: Uint8Array, formatInfo?: AudioFormatInfo) => Promise<void>;
    readonly cleanExpired: () => Promise<void>;
    // Stops the background expiry sweep started by the factory. Safe to call more than once.
    readonly stopCleanup: () => void;
};

export type AudioCacheServiceDeps = {
    readonly fileManager: FileManager;
    readonly config: Config;
    // How often the background expiry sweep runs. Pass 0 to disable it (tests, one-shot scripts).
    readonly cleanupIntervalMs?: number;
};

const CACHE_SUFFIX = ".cache";
const META_SUFFIX = ".meta.json";
const TEMP_SUFFIX = ".tmp";
const DEFAULT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

// A cache entry is the pair of files written for one URL: the audio payload (<key>.cache)
// and its optional sidecar metadata (<key>.meta.json). They are always evicted together,
// and their sizes both count toward the configured cache size limit.
type CacheEntryFile = {
    readonly path: string;
    readonly size: number;
    readonly mtime: number;
};

type CacheEntry = {
    readonly key: string;
    readonly cacheFile: CacheEntryFile | null;
    readonly metaFile: CacheEntryFile | null;
    readonly totalSize: number;
    // Age is judged by the payload file; a metadata sidecar without a payload is an orphan
    // and is treated as immediately collectable.
    readonly mtime: number;
};

export const createAudioCacheService = ({ fileManager, config, cleanupIntervalMs = DEFAULT_CLEANUP_INTERVAL_MS }: AudioCacheServiceDeps): AudioCacheService => {
    const cachePath = config.cache.audioDownloadPath;
    const ttlMs = config.cache.ttlHours * 60 * 60 * 1000;
    const maxSizeBytes = config.cache.maxSizeMb * 1024 * 1024;

    console.log(`[AudioCacheService] Creating cache service with path: ${cachePath}, TTL: ${config.cache.ttlHours}h, Max Size: ${config.cache.maxSizeMb}MB`);

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

    // Get the full cache file path for a URL
    const getCacheFilePath = (url: string): string => {
        const key = generateCacheKey(url);
        return path.join(cachePath, `${key}${CACHE_SUFFIX}`);
    };

    // Get the metadata file path for a cached audio file
    const getMetadataFilePath = (url: string): string => {
        const key = generateCacheKey(url);
        return path.join(cachePath, `${key}${META_SUFFIX}`);
    };

    // Unique sibling path used for write-to-temp-then-rename. Living in the same directory
    // keeps the rename atomic (no cross-device copy).
    const getTempFilePath = (finalPath: string): string => {
        return `${finalPath}.${process.pid}-${crypto.randomBytes(6).toString("hex")}${TEMP_SUFFIX}`;
    };

    const deleteIgnoringMissing = async (filePath: string): Promise<void> => {
        try {
            await fileManager.deleteFile(filePath);
        } catch {
            // Already gone (or raced with another sweep) - nothing to do.
        }
    };

    // Read the cache directory and group the files it holds into logical entries.
    // Depends on FileManager.listFiles returning full paths.
    const listCacheEntries = async (): Promise<CacheEntry[]> => {
        const files = await fileManager.listFiles(cachePath);

        const entries = new Map<string, { cacheFile: CacheEntryFile | null; metaFile: CacheEntryFile | null }>();
        const staleTempFiles: string[] = [];

        for (const file of files) {
            const name = path.basename(file);

            if (name.endsWith(TEMP_SUFFIX)) {
                staleTempFiles.push(file);
                continue;
            }

            const isMeta = name.endsWith(META_SUFFIX);
            const isCache = name.endsWith(CACHE_SUFFIX);
            if (!isMeta && !isCache) continue;

            const key = isMeta ? name.slice(0, -META_SUFFIX.length) : name.slice(0, -CACHE_SUFFIX.length);

            let stats;
            try {
                stats = await fileManager.getFileStats(file);
            } catch (error) {
                console.error(`[AudioCacheService] Error getting stats for ${file}:`, error);
                continue;
            }
            if (!stats) continue;

            const entryFile: CacheEntryFile = { path: file, size: stats.size, mtime: stats.mtime.getTime() };
            const existing = entries.get(key) ?? { cacheFile: null, metaFile: null };
            entries.set(key, isMeta ? { ...existing, metaFile: entryFile } : { ...existing, cacheFile: entryFile });
        }

        // Temp files only survive a crash mid-write; clear the ones that are clearly abandoned.
        const now = Date.now();
        for (const tempFile of staleTempFiles) {
            try {
                const stats = await fileManager.getFileStats(tempFile);
                if (stats && now - stats.mtime.getTime() > ttlMs) {
                    await deleteIgnoringMissing(tempFile);
                }
            } catch (error) {
                console.error(`[AudioCacheService] Error inspecting temp file ${tempFile}:`, error);
            }
        }

        return [...entries.entries()].map(([key, { cacheFile, metaFile }]) => ({
            key,
            cacheFile,
            metaFile,
            totalSize: (cacheFile?.size ?? 0) + (metaFile?.size ?? 0),
            mtime: cacheFile?.mtime ?? 0,
        }));
    };

    // Removes both files of an entry so metadata is never left orphaned.
    const deleteEntry = async (entry: CacheEntry): Promise<void> => {
        if (entry.cacheFile) await deleteIgnoringMissing(entry.cacheFile.path);
        if (entry.metaFile) await deleteIgnoringMissing(entry.metaFile.path);
    };

    // Check if cache file exists and is not expired
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
            if (!stats) {
                console.log(`[AudioCacheService] Cache file disappeared for: ${url}`);
                return null;
            }
            const age = Date.now() - stats.mtime.getTime();
            if (age > ttlMs) {
                console.log(`[AudioCacheService] Cache expired for: ${url} (age: ${Math.round(age / 1000 / 60)}min, ttl: ${config.cache.ttlHours}h)`);
                // Clean up expired cache and metadata
                await deleteIgnoringMissing(filePath);
                await deleteIgnoringMissing(metadataPath);
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

    // Save audio data to cache with format information.
    // Both files are written to a unique temp sibling and renamed into place, so a concurrent
    // writer for the same URL can never interleave bytes into a half-written cache file:
    // the loser of the race simply replaces the winner's (identical) file wholesale.
    const saveToCache = async (url: string, audioData: Uint8Array, formatInfo?: AudioFormatInfo): Promise<void> => {
        const filePath = getCacheFilePath(url);
        const metadataPath = getMetadataFilePath(url);

        try {
            console.log(`[AudioCacheService] Saving to cache: ${url} -> ${filePath}`);
            const tempFilePath = getTempFilePath(filePath);
            try {
                // Wrapped as a Buffer view (no copy) so Readable.from emits one binary chunk;
                // a bare Uint8Array would be iterated into an object-mode stream of numbers.
                const buffer = Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData.buffer, audioData.byteOffset, audioData.byteLength);
                await fileManager.writeStream(tempFilePath, Readable.from(buffer));
                await fileManager.renameFile(tempFilePath, filePath);
            } catch (error) {
                await deleteIgnoringMissing(tempFilePath);
                throw error;
            }

            if (formatInfo) {
                const metadata: AudioCacheMetadata = {
                    formatInfo,
                    cachedAt: Date.now(),
                };

                console.log(`[AudioCacheService] Saving metadata: ${url} -> ${metadataPath}`, metadata);
                const tempMetadataPath = getTempFilePath(metadataPath);
                try {
                    await fileManager.writeFile(tempMetadataPath, JSON.stringify(metadata, null, 2));
                    await fileManager.renameFile(tempMetadataPath, metadataPath);
                } catch (error) {
                    await deleteIgnoringMissing(tempMetadataPath);
                    throw error;
                }
            }

            console.log(`[AudioCacheService] Successfully cached: ${url}`);

            // Evict oldest files if cache size exceeds limit
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

            const entries = await listCacheEntries();
            const now = Date.now();
            const expired = entries.filter(entry => now - entry.mtime > ttlMs);

            // Run clean-up of expired entries in parallel for speed
            await Promise.all(
                expired.map(async entry => {
                    try {
                        await deleteEntry(entry);
                    } catch (error) {
                        console.error(`[AudioCacheService] Error cleaning cache entry ${entry.key}:`, error);
                    }
                })
            );

            console.log(`[AudioCacheService] Cache cleanup complete. Removed ${expired.length} expired entries.`);
        } catch (error) {
            console.error(`[AudioCacheService] Error during cache cleanup:`, error);
        }
    };

    // Evict oldest cache entries if total size exceeds the limit
    // Entries are evicted based on oldest mtime (shortest TTL remaining)
    const evictIfNeeded = async (): Promise<void> => {
        try {
            const entries = await listCacheEntries();

            // Calculate total cache size (payload + metadata sidecars)
            const totalSize = entries.reduce((sum, entry) => sum + entry.totalSize, 0);

            console.log(`[AudioCacheService] Current cache size: ${(totalSize / 1024 / 1024).toFixed(2)}MB / ${config.cache.maxSizeMb}MB`);

            if (totalSize <= maxSizeBytes) {
                console.log(`[AudioCacheService] Cache size within limit, no eviction needed`);
                return;
            }

            // Sort entries by mtime (oldest first - shortest TTL remaining)
            const sorted = [...entries].sort((a, b) => a.mtime - b.mtime);

            let evictedCount = 0;
            let evictedSize = 0;

            // Evict oldest entries until we're under the limit
            for (const entry of sorted) {
                if (totalSize - evictedSize <= maxSizeBytes) {
                    break;
                }

                try {
                    await deleteEntry(entry);
                    evictedSize += entry.totalSize;
                    evictedCount++;
                    console.log(`[AudioCacheService] Evicted: ${entry.key} (${(entry.totalSize / 1024 / 1024).toFixed(2)}MB)`);
                } catch (error) {
                    console.error(`[AudioCacheService] Error evicting entry ${entry.key}:`, error);
                }
            }

            console.log(`[AudioCacheService] Eviction complete. Removed ${evictedCount} entries (${(evictedSize / 1024 / 1024).toFixed(2)}MB). New size: ${((totalSize - evictedSize) / 1024 / 1024).toFixed(2)}MB`);
        } catch (error) {
            console.error(`[AudioCacheService] Error during cache eviction:`, error);
        }
    };

    // Expiry is otherwise only enforced lazily on a cache hit, which never fires for entries
    // that are never requested again - so sweep on a timer. unref'd so it can't hold the
    // process open on shutdown.
    let cleanupTimer: NodeJS.Timeout | null = null;
    if (cleanupIntervalMs > 0) {
        cleanupTimer = setInterval(() => {
            void cleanExpired();
        }, cleanupIntervalMs);
        cleanupTimer.unref?.();
        // Sweep once at startup too: the process may have been down for longer than the TTL.
        void cleanExpired();
    }

    const stopCleanup = (): void => {
        if (cleanupTimer) {
            clearInterval(cleanupTimer);
            cleanupTimer = null;
        }
    };

    return {
        getCached,
        saveToCache,
        cleanExpired,
        stopCleanup,
    };
};
