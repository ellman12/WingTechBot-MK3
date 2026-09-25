import type { AudioFormatInfo } from "@core/entities/AudioFormatInfo.js";
import type { AudioCacheEntry, AudioCacheStore } from "@core/ports/repositories/AudioCacheStore.js";
import { createAudioCacheService } from "@core/services/AudioCacheService.js";
import { Readable } from "stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTestConfig } from "../../../setup.js";

const HOUR_MS = 60 * 60 * 1000;
const MB = 1024 * 1024;

type StoredEntry = { audio: Uint8Array; formatInfo?: AudioFormatInfo; cachedAt: Date };

const createInMemoryStore = () => {
    const entries = new Map<string, StoredEntry>();
    const toEntry = (key: string, stored: StoredEntry): AudioCacheEntry => ({ key, sizeBytes: stored.audio.length, cachedAt: stored.cachedAt });

    const store: AudioCacheStore = {
        stat: vi.fn(async key => {
            const stored = entries.get(key);
            return stored ? toEntry(key, stored) : null;
        }),
        read: vi.fn(async key => {
            const stored = entries.get(key)!;
            return { stream: Readable.from([stored.audio]), formatInfo: stored.formatInfo };
        }),
        write: vi.fn(async (key, audio, formatInfo) => {
            entries.set(key, { audio, formatInfo, cachedAt: new Date() });
        }),
        delete: vi.fn(async key => {
            entries.delete(key);
        }),
        list: vi.fn(async () => [...entries].map(([key, stored]) => toEntry(key, stored))),
    };

    return { store, entries };
};

const formatInfo: AudioFormatInfo = { format: "mp3", container: "mp3", codec: "mp3", sampleRate: 44100, channels: 2, bitrate: 128000 };

describe("AudioCacheService", () => {
    const baseConfig = getTestConfig();
    const config = { ...baseConfig, cache: { ...baseConfig.cache, ttlHours: 1, maxSizeMb: 2 } };
    let memory: ReturnType<typeof createInMemoryStore>;

    beforeEach(() => {
        memory = createInMemoryStore();
    });

    it("returns saved audio with its format info", async () => {
        const service = createAudioCacheService({ audioCacheStore: memory.store, config });

        await service.saveToCache("https://youtu.be/dQw4w9WgXcQ", new Uint8Array([1, 2, 3]), formatInfo);
        const cached = await service.getCached("https://www.youtube.com/watch?v=dQw4w9WgXcQ");

        expect(memory.store.write).toHaveBeenCalledWith("yt_dQw4w9WgXcQ", expect.any(Uint8Array), formatInfo);
        expect(cached?.formatInfo).toEqual(formatInfo);
    });

    it("misses and deletes expired entries", async () => {
        const service = createAudioCacheService({ audioCacheStore: memory.store, config });
        await service.saveToCache("https://example.com/a.mp3", new Uint8Array([1]));
        const [key] = [...memory.entries.keys()];
        memory.entries.get(key!)!.cachedAt = new Date(Date.now() - 2 * HOUR_MS);

        expect(await service.getCached("https://example.com/a.mp3")).toBeNull();
        expect(memory.store.delete).toHaveBeenCalledWith(key);
        expect(memory.entries.size).toBe(0);
    });

    it("evicts the oldest entries once the cache exceeds its size limit", async () => {
        const service = createAudioCacheService({ audioCacheStore: memory.store, config });
        const now = Date.now();

        await service.saveToCache("https://example.com/old.mp3", new Uint8Array(1 * MB));
        await service.saveToCache("https://example.com/mid.mp3", new Uint8Array(1 * MB));
        const [oldKey, midKey] = [...memory.entries.keys()];
        memory.entries.get(oldKey!)!.cachedAt = new Date(now - 30 * 60 * 1000);
        memory.entries.get(midKey!)!.cachedAt = new Date(now - 10 * 60 * 1000);

        await service.saveToCache("https://example.com/new.mp3", new Uint8Array(1 * MB));

        expect(memory.entries.has(oldKey!)).toBe(false);
        expect(memory.entries.has(midKey!)).toBe(true);
        expect(memory.entries.size).toBe(2);
    });

    it("cleanExpired removes only expired entries", async () => {
        const service = createAudioCacheService({ audioCacheStore: memory.store, config });
        await service.saveToCache("https://example.com/stale.mp3", new Uint8Array([1]));
        await service.saveToCache("https://example.com/fresh.mp3", new Uint8Array([2]));
        const [staleKey, freshKey] = [...memory.entries.keys()];
        memory.entries.get(staleKey!)!.cachedAt = new Date(Date.now() - 2 * HOUR_MS);

        await service.cleanExpired();

        expect([...memory.entries.keys()]).toEqual([freshKey]);
    });
});
