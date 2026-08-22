import type { Config } from "@core/config/Config.js";
import type { FileManager } from "@core/ports/services/FileManager.js";
import { createAudioCacheService } from "@core/services/AudioCacheService.js";
import type fs from "fs";
import path from "path";
import { Readable } from "stream";
import { describe, expect, it, vi } from "vitest";

import { getTestConfig } from "../../../setup.js";

const CACHE_DIR = "/tmp/wtb-test-cache";

type FakeFile = {
    content: string;
    size: number;
    mtime: number;
};

// In-memory FileManager. Only the members AudioCacheService uses are backed by real behaviour;
// the rest throw so an accidental dependency shows up as a failure rather than a silent no-op.
const createFakeFileManager = (initialFiles: Record<string, Partial<FakeFile>> = {}) => {
    const files = new Map<string, FakeFile>();

    for (const [name, file] of Object.entries(initialFiles)) {
        files.set(path.join(CACHE_DIR, name), {
            content: file.content ?? "",
            size: file.size ?? file.content?.length ?? 0,
            mtime: file.mtime ?? Date.now(),
        });
    }

    const unsupported = (member: string) => () => {
        throw new Error(`FakeFileManager.${member} should not be called`);
    };

    const fileManager: FileManager = {
        readFile: async filePath => {
            const file = files.get(filePath);
            if (!file) throw new Error(`ENOENT: ${filePath}`);
            return file.content;
        },
        readStream: filePath => Readable.from([files.get(filePath)?.content ?? ""]),
        writeFile: async (filePath, content) => {
            files.set(filePath, { content, size: content.length, mtime: Date.now() });
        },
        writeStream: async (filePath, content) => {
            const chunks: Buffer[] = [];
            for await (const chunk of content) chunks.push(Buffer.from(chunk as Uint8Array));
            const buffer = Buffer.concat(chunks);
            files.set(filePath, { content: buffer.toString("binary"), size: buffer.length, mtime: Date.now() });
        },
        deleteFile: async filePath => {
            if (!files.delete(filePath)) throw new Error(`ENOENT: ${filePath}`);
        },
        renameFile: async (oldPath, newPath) => {
            const file = files.get(oldPath);
            if (!file) throw new Error(`ENOENT: ${oldPath}`);
            files.delete(oldPath);
            files.set(newPath, file);
        },
        fileExists: async filePath => files.has(filePath),
        // Mirrors the real implementation: full paths, not bare basenames.
        listFiles: async directory => [...files.keys()].filter(filePath => path.dirname(filePath) === directory),
        getFileStats: async filePath => {
            const file = files.get(filePath);
            if (!file) return null;
            return { size: file.size, mtime: new Date(file.mtime) } as fs.Stats;
        },
        getCachePath: unsupported("getCachePath"),
        readCache: unsupported("readCache"),
        writeCache: unsupported("writeCache"),
        deleteCache: unsupported("deleteCache"),
        clearAllCache: unsupported("clearAllCache"),
    };

    return { fileManager, files, names: () => [...files.keys()].map(filePath => path.basename(filePath)).sort() };
};

const testConfig = (overrides: Partial<Config["cache"]> = {}): Config => {
    const base = getTestConfig();
    return {
        ...base,
        cache: {
            audioDownloadPath: CACHE_DIR,
            ttlHours: 24,
            maxSizeMb: 1000,
            ...overrides,
        },
    };
};

// The service is always created with the background sweep disabled so tests drive it explicitly.
const createService = (fileManager: FileManager, cacheOverrides: Partial<Config["cache"]> = {}) => createAudioCacheService({ fileManager, config: testConfig(cacheOverrides), cleanupIntervalMs: 0 });

const MB = 1024 * 1024;
const HOUR = 60 * 60 * 1000;

describe("AudioCacheService", () => {
    describe("evictIfNeeded (via saveToCache)", () => {
        it("counts existing cache files toward the size limit and evicts the oldest", async () => {
            // Regression for the bug where listFiles returned bare basenames: getFileStats then
            // resolved them against the CWD, returned null for every file, and the computed cache
            // size was always 0 so nothing was ever evicted.
            const now = Date.now();
            const { fileManager, names } = createFakeFileManager({
                "url_old.cache": { size: 4 * MB, mtime: now - 3 * HOUR },
                "url_mid.cache": { size: 4 * MB, mtime: now - 2 * HOUR },
                "url_new.cache": { size: 4 * MB, mtime: now - 1 * HOUR },
            });

            const service = createService(fileManager, { maxSizeMb: 10 });
            await service.saveToCache("https://example.com/song.mp3", new Uint8Array(16));

            // 12MB of pre-existing entries plus the new one exceeds 10MB, so the oldest goes.
            expect(names()).not.toContain("url_old.cache");
            expect(names()).toContain("url_mid.cache");
            expect(names()).toContain("url_new.cache");
        });

        it("does not evict anything while the cache is under the limit", async () => {
            const { fileManager, names } = createFakeFileManager({
                "url_a.cache": { size: 1 * MB, mtime: Date.now() - HOUR },
            });

            const service = createService(fileManager, { maxSizeMb: 10 });
            await service.saveToCache("https://example.com/song.mp3", new Uint8Array(16));

            expect(names()).toContain("url_a.cache");
        });

        it("evicts an entry's metadata sidecar along with its payload and counts both toward the total", async () => {
            const now = Date.now();
            const { fileManager, names } = createFakeFileManager({
                "url_old.cache": { size: 4 * MB, mtime: now - 3 * HOUR },
                "url_old.meta.json": { size: 2 * MB, mtime: now - 3 * HOUR },
                "url_new.cache": { size: 4 * MB, mtime: now - HOUR },
                "url_new.meta.json": { size: 1 * MB, mtime: now - HOUR },
            });

            const service = createService(fileManager, { maxSizeMb: 10 });
            await service.saveToCache("https://example.com/song.mp3", new Uint8Array(16));

            // 11MB total, so the oldest entry is evicted whole - no orphaned metadata left behind.
            expect(names()).not.toContain("url_old.cache");
            expect(names()).not.toContain("url_old.meta.json");
            expect(names()).toContain("url_new.cache");
            expect(names()).toContain("url_new.meta.json");
        });
    });

    describe("cleanExpired", () => {
        it("deletes entries older than the TTL and keeps fresh ones", async () => {
            const now = Date.now();
            const { fileManager, names } = createFakeFileManager({
                "url_expired.cache": { size: 10, mtime: now - 25 * HOUR },
                "url_expired.meta.json": { size: 10, mtime: now - 25 * HOUR },
                "url_fresh.cache": { size: 10, mtime: now - 1 * HOUR },
                "url_fresh.meta.json": { size: 10, mtime: now - 1 * HOUR },
            });

            const service = createService(fileManager, { ttlHours: 24 });
            await service.cleanExpired();

            expect(names()).toEqual(["url_fresh.cache", "url_fresh.meta.json"]);
        });

        it("keeps a fresh entry whose metadata sidecar is older than the TTL", async () => {
            const now = Date.now();
            const { fileManager, names } = createFakeFileManager({
                "url_a.cache": { size: 10, mtime: now - 1 * HOUR },
                "url_a.meta.json": { size: 10, mtime: now - 30 * HOUR },
            });

            const service = createService(fileManager, { ttlHours: 24 });
            await service.cleanExpired();

            expect(names()).toEqual(["url_a.cache", "url_a.meta.json"]);
        });

        it("removes metadata orphaned by a missing payload", async () => {
            const { fileManager, names } = createFakeFileManager({
                "url_orphan.meta.json": { size: 10, mtime: Date.now() },
            });

            const service = createService(fileManager, { ttlHours: 24 });
            await service.cleanExpired();

            expect(names()).toEqual([]);
        });

        it("ignores unrelated files in the cache directory", async () => {
            const { fileManager, names } = createFakeFileManager({
                "README.txt": { size: 10, mtime: 0 },
            });

            const service = createService(fileManager, { ttlHours: 24 });
            await service.cleanExpired();

            expect(names()).toEqual(["README.txt"]);
        });
    });

    describe("background cleanup", () => {
        it("sweeps on startup and on the configured interval, and stops on request", async () => {
            vi.useFakeTimers();
            try {
                const now = Date.now();
                const { fileManager } = createFakeFileManager({ "url_a.cache": { size: 10, mtime: now - 30 * HOUR } });
                const listFiles = vi.spyOn(fileManager, "listFiles");

                const service = createAudioCacheService({ fileManager, config: testConfig(), cleanupIntervalMs: 1000 });
                await vi.advanceTimersByTimeAsync(0);
                expect(listFiles).toHaveBeenCalledTimes(1);

                await vi.advanceTimersByTimeAsync(2000);
                expect(listFiles).toHaveBeenCalledTimes(3);

                service.stopCleanup();
                await vi.advanceTimersByTimeAsync(5000);
                expect(listFiles).toHaveBeenCalledTimes(3);
            } finally {
                vi.useRealTimers();
            }
        });
    });

    describe("saveToCache", () => {
        it("writes through a temp file and renames it into place, leaving no temp files behind", async () => {
            const { fileManager, names } = createFakeFileManager();
            const writeStream = vi.spyOn(fileManager, "writeStream");
            const renameFile = vi.spyOn(fileManager, "renameFile");

            const service = createService(fileManager);
            await service.saveToCache("https://example.com/song.mp3", new Uint8Array([1, 2, 3]), {
                format: "mp3",
                container: "mp3",
                codec: "mp3",
                sampleRate: 0,
                channels: 0,
                bitrate: 0,
            });

            // Payload and metadata are both staged under a temp name first.
            expect(writeStream.mock.calls[0]?.[0]).toMatch(/\.tmp$/);
            expect(renameFile).toHaveBeenCalledTimes(2);
            expect(names().every(name => !name.endsWith(".tmp"))).toBe(true);
            expect(names()).toHaveLength(2);
        });

        it("cleans up the temp file when the rename fails", async () => {
            const { fileManager, names } = createFakeFileManager();
            vi.spyOn(fileManager, "renameFile").mockRejectedValue(new Error("EXDEV"));

            const service = createService(fileManager);
            // saveToCache must never throw - a caching failure cannot break playback.
            await expect(service.saveToCache("https://example.com/song.mp3", new Uint8Array([1, 2, 3]))).resolves.toBeUndefined();

            expect(names()).toEqual([]);
        });
    });

    describe("getCached", () => {
        it("returns a stream for a fresh entry", async () => {
            const url = "https://example.com/song.mp3";
            const { fileManager } = createFakeFileManager();
            const service = createService(fileManager);

            await service.saveToCache(url, new Uint8Array([1, 2, 3]), {
                format: "mp3",
                container: "mp3",
                codec: "mp3",
                sampleRate: 0,
                channels: 0,
                bitrate: 0,
            });

            const cached = await service.getCached(url);
            expect(cached).not.toBeNull();
            expect(cached?.formatInfo?.codec).toBe("mp3");
        });

        it("returns null and drops both files when the entry is expired", async () => {
            const url = "https://example.com/song.mp3";
            const { fileManager, files, names } = createFakeFileManager();
            const service = createService(fileManager, { ttlHours: 1 });

            await service.saveToCache(url, new Uint8Array([1, 2, 3]), {
                format: "mp3",
                container: "mp3",
                codec: "mp3",
                sampleRate: 0,
                channels: 0,
                bitrate: 0,
            });

            for (const file of files.values()) file.mtime = Date.now() - 5 * HOUR;

            expect(await service.getCached(url)).toBeNull();
            expect(names()).toEqual([]);
        });

        it("returns null on a miss", async () => {
            const { fileManager } = createFakeFileManager();
            const service = createService(fileManager);

            expect(await service.getCached("https://example.com/missing.mp3")).toBeNull();
        });
    });
});
