import { createFsAudioCacheStore } from "@adapters/filestore/FsAudioCacheStore.js";
import type { AudioFormatInfo } from "@core/entities/AudioFormatInfo.js";
import { readStreamToBytes } from "@core/utils/streamUtils.js";
import { mkdtempSync, rmSync } from "fs";
import { readdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getTestConfig } from "../../../setup.js";

const formatInfo: AudioFormatInfo = { format: "mp3", container: "mp3", codec: "mp3", sampleRate: 44100, channels: 2, bitrate: 128000 };

describe("FsAudioCacheStore", () => {
    let dir: string;
    let store: ReturnType<typeof createFsAudioCacheStore>;

    beforeEach(() => {
        dir = join(mkdtempSync(join(tmpdir(), "audio-cache-store-")), "cache");
        const baseConfig = getTestConfig();
        store = createFsAudioCacheStore({ config: { ...baseConfig, cache: { ...baseConfig.cache, audioDownloadPath: dir } } });
    });

    afterEach(() => {
        rmSync(join(dir, ".."), { recursive: true, force: true });
    });

    it("round-trips audio and format info", async () => {
        await store.write("yt_abc", new Uint8Array([1, 2, 3]), formatInfo);

        const cached = await store.read("yt_abc");

        expect(cached.formatInfo).toEqual(formatInfo);
        expect([...(await readStreamToBytes(cached.stream))]).toEqual([1, 2, 3]);
    });

    it("lists one entry per key with the audio size, ignoring metadata files", async () => {
        await store.write("a", new Uint8Array(10), formatInfo);
        await store.write("b", new Uint8Array(20));

        const entries = await store.list();

        expect(entries.map(entry => [entry.key, entry.sizeBytes]).sort()).toEqual([
            ["a", 10],
            ["b", 20],
        ]);
        expect(entries.every(entry => entry.cachedAt instanceof Date)).toBe(true);
    });

    it("returns an empty list and null stat before anything is cached", async () => {
        expect(await store.list()).toEqual([]);
        expect(await store.stat("missing")).toBeNull();
    });

    it("deletes the audio and its metadata", async () => {
        await store.write("a", new Uint8Array(10), formatInfo);

        await store.delete("a");
        await store.delete("a");

        expect(await readdir(dir)).toEqual([]);
    });

    it("drops stale metadata when an entry is rewritten without format info", async () => {
        await store.write("a", new Uint8Array(10), formatInfo);
        await store.write("a", new Uint8Array(10));

        const cached = await store.read("a");
        cached.stream.destroy();

        expect(cached.formatInfo).toBeUndefined();
    });
});
