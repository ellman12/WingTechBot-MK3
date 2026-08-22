import type { Config } from "@core/config/Config.js";
import type { SoundRepository } from "@core/ports/repositories/SoundRepository.js";
import type { AudioProcessingService } from "@core/ports/services/AudioProcessingService.js";
import type { FileManager } from "@core/ports/services/FileManager.js";
import type { AudioFetcherService } from "@core/services/AudioFetcherService.js";
import { parseAudioSource } from "@core/services/AudioFetcherService.js";
import { REPEATED_SOUND_TTL_MS, createSoundService } from "@core/services/SoundService.js";
import { createRepeatedPcmStream } from "@core/utils/audio/pcmRepeater.js";
import path from "path";
import { Readable } from "stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getTestConfig } from "../../../setup.js";

// Mock parseAudioSource from AudioFetcherService

// Mock parseAudioSource from AudioFetcherService

// Mock parseAudioSource from AudioFetcherService
vi.mock("@core/services/AudioFetcherService", async () => {
    const actual = await vi.importActual<typeof import("@core/services/AudioFetcherService")>("@core/services/AudioFetcherService");
    return {
        ...actual,
        parseAudioSource: vi.fn(),
    };
});

vi.mock("@core/utils/audio/pcmRepeater", () => ({
    createRepeatedPcmStream: vi.fn(),
}));

// Mock dependencies
const mockAudioFetcher: AudioFetcherService = {
    fetchUrlAudio: vi.fn(),
    fetchSoundboardAudio: vi.fn(),
};

const mockAudioProcessor: AudioProcessingService = {
    deepProcessAudio: vi.fn(),
    processAudioStream: vi.fn(),
};

const mockFileManager: FileManager = {
    readStream: vi.fn(),
    writeStream: vi.fn(),
    deleteFile: vi.fn(),
    renameFile: vi.fn(),
    fileExists: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    listFiles: vi.fn(),
    getFileStats: vi.fn(),
    getCachePath: vi.fn(),
    readCache: vi.fn(),
    writeCache: vi.fn(),
    deleteCache: vi.fn(),
    clearAllCache: vi.fn(),
};

const mockSoundRepository: SoundRepository = {
    addSound: vi.fn(),
    getSoundByName: vi.fn(),
    getAllSounds: vi.fn(),
    deleteSound: vi.fn(),
    getAllSoundsWithTagName: vi.fn(),
    tryGetSoundsWithinDistance: vi.fn(),
};

const mockConfig: Config = getTestConfig();

// Paths handed to the FileManager are resolved absolute paths inside the sound store
const soundFilePath = (relativePath: string): string => path.resolve(mockConfig.sounds.storagePath, `.${relativePath}`);

// Remove describe.concurrent - not worth the complexity for tests with module mocks
describe("SoundService", () => {
    let soundService: ReturnType<typeof createSoundService>;

    beforeEach(() => {
        vi.clearAllMocks();
        const deps = {
            audioFetcher: mockAudioFetcher,
            audioProcessor: mockAudioProcessor,
            fileManager: mockFileManager,
            soundRepository: mockSoundRepository,
            config: mockConfig,
        };
        soundService = createSoundService(deps);
    });

    describe("addSound", () => {
        it("should successfully add a sound from URL", async () => {
            const testAudio = new Uint8Array([1, 2, 3, 4]);
            const processedAudio = new Uint8Array([5, 6, 7, 8]);
            const mockStream = Readable.from([testAudio]);

            vi.mocked(mockAudioFetcher.fetchUrlAudio).mockResolvedValue({
                stream: mockStream,
                formatInfo: {
                    format: "mp3",
                    container: "mp3",
                    codec: "mp3",
                    sampleRate: 44100,
                    channels: 2,
                    bitrate: 128000,
                },
            });
            vi.mocked(mockAudioProcessor.deepProcessAudio).mockResolvedValue(processedAudio);
            vi.mocked(mockFileManager.writeStream).mockResolvedValue(undefined);

            await soundService.addSound("test-sound", "https://example.com/audio.mp3");

            expect(mockAudioFetcher.fetchUrlAudio).toHaveBeenCalledWith("https://example.com/audio.mp3", expect.any(AbortSignal));
            expect(mockAudioProcessor.deepProcessAudio).toHaveBeenCalledWith(expect.any(Buffer), expect.any(String), expect.any(String));
            expect(mockFileManager.writeStream).toHaveBeenCalledWith(soundFilePath("/test-sound.pcm"), expect.any(Readable));
            expect(mockSoundRepository.addSound).toHaveBeenCalledWith({
                name: "test-sound",
                path: "/test-sound.pcm",
            });
        });

        it("should delete the written file when the database insert fails", async () => {
            const mockStream = Readable.from([new Uint8Array([1, 2, 3, 4])]);

            vi.mocked(mockAudioFetcher.fetchUrlAudio).mockResolvedValue({
                stream: mockStream,
                formatInfo: {
                    format: "mp3",
                    container: "mp3",
                    codec: "mp3",
                    sampleRate: 44100,
                    channels: 2,
                    bitrate: 128000,
                },
            });
            vi.mocked(mockAudioProcessor.deepProcessAudio).mockResolvedValue(new Uint8Array([5, 6, 7, 8]));
            vi.mocked(mockFileManager.writeStream).mockResolvedValue(undefined);
            vi.mocked(mockSoundRepository.addSound).mockRejectedValue(new Error("duplicate key value violates unique constraint"));
            vi.mocked(mockFileManager.deleteFile).mockResolvedValue(undefined);

            await expect(soundService.addSound("test-sound", "https://example.com/audio.mp3")).rejects.toThrow("duplicate key value violates unique constraint");

            expect(mockFileManager.deleteFile).toHaveBeenCalledWith(soundFilePath("/test-sound.pcm"));
        });

        it("should still throw the original error when cleanup also fails", async () => {
            const mockStream = Readable.from([new Uint8Array([1, 2, 3, 4])]);

            vi.mocked(mockAudioFetcher.fetchUrlAudio).mockResolvedValue({
                stream: mockStream,
                formatInfo: {
                    format: "mp3",
                    container: "mp3",
                    codec: "mp3",
                    sampleRate: 44100,
                    channels: 2,
                    bitrate: 128000,
                },
            });
            vi.mocked(mockAudioProcessor.deepProcessAudio).mockResolvedValue(new Uint8Array([5, 6, 7, 8]));
            vi.mocked(mockFileManager.writeStream).mockResolvedValue(undefined);
            vi.mocked(mockSoundRepository.addSound).mockRejectedValue(new Error("insert failed"));
            vi.mocked(mockFileManager.deleteFile).mockRejectedValue(new Error("unlink failed"));

            await expect(soundService.addSound("test-sound", "https://example.com/audio.mp3")).rejects.toThrow("insert failed");
        });

        it("should handle errors during sound addition", async () => {
            vi.mocked(mockAudioFetcher.fetchUrlAudio).mockRejectedValue(new Error("Network error"));

            await expect(soundService.addSound("test-sound", "bad-url")).rejects.toThrow("Network error");
        });
    });

    describe("getSound", () => {
        it("should return direct file stream for soundboard audio", async () => {
            const mockFileStream = Readable.from(["audio data"]);

            vi.mocked(parseAudioSource).mockReturnValue("soundboard");
            vi.mocked(mockSoundRepository.getSoundByName).mockResolvedValue({
                name: "test-sound",
                path: "/test-sound.pcm",
            });
            vi.mocked(mockFileManager.readStream).mockReturnValue(mockFileStream);

            const result = await soundService.getSound("test-sound");

            // The result should be a stream
            expect(result).toBeInstanceOf(Readable);
            expect(mockSoundRepository.getSoundByName).toHaveBeenCalledWith("test-sound");
            expect(mockFileManager.readStream).toHaveBeenCalledWith(soundFilePath("/test-sound.pcm"));
        });

        it("should process and pre-buffer URL/YouTube audio", async () => {
            const mockAudioStream = Readable.from(["raw audio"]);
            const mockProcessedStream = Readable.from(["processed audio"]);
            const mockAudioWithMetadata = {
                stream: mockAudioStream,
                formatInfo: {
                    format: "webm",
                    container: "webm",
                    codec: "opus",
                    sampleRate: 48000,
                    channels: 2,
                    bitrate: 128000,
                },
            };

            vi.mocked(parseAudioSource).mockReturnValue("youtube");
            vi.mocked(mockAudioFetcher.fetchUrlAudio).mockResolvedValue(mockAudioWithMetadata);
            vi.mocked(mockAudioProcessor.processAudioStream).mockReturnValue(mockProcessedStream);

            const result = await soundService.getSound("https://youtube.com/watch?v=test");

            expect(mockAudioFetcher.fetchUrlAudio).toHaveBeenCalledWith("https://youtube.com/watch?v=test", undefined);
            expect(mockAudioProcessor.processAudioStream).toHaveBeenCalledWith(mockAudioWithMetadata);
            expect(result).toBeInstanceOf(Readable);
        });
    });

    describe("listSounds", () => {
        it("should return list of sound names", async () => {
            const mockSounds = [
                { name: "sound1", path: "/sound1.pcm" },
                { name: "sound2", path: "/sound2.pcm" },
            ];

            vi.mocked(mockSoundRepository.getAllSounds).mockResolvedValue(mockSounds);

            const result = await soundService.listSounds();

            expect(result).toEqual(["sound1", "sound2"]);
            expect(mockSoundRepository.getAllSounds).toHaveBeenCalled();
        });

        it("should return empty array when no sounds exist", async () => {
            vi.mocked(mockSoundRepository.getAllSounds).mockResolvedValue([]);

            const result = await soundService.listSounds();

            expect(result).toEqual([]);
        });
    });

    describe("deleteSound", () => {
        it("should successfully delete a sound", async () => {
            const mockSound = { name: "test-sound", path: "/test-sound.pcm" };

            vi.mocked(mockSoundRepository.getSoundByName).mockResolvedValue(mockSound);
            vi.mocked(mockFileManager.deleteFile).mockResolvedValue(undefined);
            vi.mocked(mockSoundRepository.deleteSound).mockResolvedValue(undefined);

            await soundService.deleteSound("test-sound");

            expect(mockSoundRepository.getSoundByName).toHaveBeenCalledWith("test-sound");
            expect(mockFileManager.deleteFile).toHaveBeenCalledWith(soundFilePath("/test-sound.pcm"));
            expect(mockSoundRepository.deleteSound).toHaveBeenCalledWith("test-sound");
        });

        it("should throw error for non-existent sound", async () => {
            vi.mocked(mockSoundRepository.getSoundByName).mockResolvedValue(null);

            await expect(soundService.deleteSound("non-existent")).rejects.toThrow("Sound with name non-existent not found");
        });
    });
    describe("path traversal protection", () => {
        const traversalNames = ["../evil", "../../../etc/passwd", "sub/dir/evil", "sounds/../../evil", "/etc/cron.d/evil"];

        it.each(traversalNames)("should refuse to write a sound named %s outside the sound store", async traversalName => {
            await expect(soundService.addSound(traversalName, "https://example.com/audio.mp3")).rejects.toThrow(/must resolve to a file directly inside the sound storage directory/);

            expect(mockAudioFetcher.fetchUrlAudio).not.toHaveBeenCalled();
            expect(mockFileManager.writeStream).not.toHaveBeenCalled();
            expect(mockSoundRepository.addSound).not.toHaveBeenCalled();
        });

        // Rows written before this fix (or by another writer) could already contain a hostile path
        const hostileStoredPaths = ["/../../../etc/passwd", "/../escaped.pcm", "/../../", "/", "/nested/evil.pcm"];

        it.each(hostileStoredPaths)("should refuse to read a stored sound whose path is %s", async hostilePath => {
            vi.mocked(parseAudioSource).mockReturnValue("soundboard");
            vi.mocked(mockSoundRepository.getSoundByName).mockResolvedValue({ name: "evil", path: hostilePath });

            await expect(soundService.getSound("evil")).rejects.toThrow(/must resolve to a file directly inside the sound storage directory/);
            expect(mockFileManager.readStream).not.toHaveBeenCalled();
        });

        it.each(hostileStoredPaths)("should refuse to delete a stored sound whose path is %s", async hostilePath => {
            vi.mocked(mockSoundRepository.getSoundByName).mockResolvedValue({ name: "evil", path: hostilePath });

            await expect(soundService.deleteSound("evil")).rejects.toThrow(/must resolve to a file directly inside the sound storage directory/);
            expect(mockFileManager.deleteFile).not.toHaveBeenCalled();
            expect(mockSoundRepository.deleteSound).not.toHaveBeenCalled();
        });

        it("should treat backslashes and encoded traversal as ordinary characters inside the store", async () => {
            // These are not traversal on posix, but they must still stay inside the store
            vi.mocked(parseAudioSource).mockReturnValue("soundboard");
            vi.mocked(mockSoundRepository.getSoundByName).mockResolvedValue({ name: "weird", path: "/..%2f..%2fescaped.pcm" });
            vi.mocked(mockFileManager.readStream).mockReturnValue(Readable.from(["audio data"]));

            await soundService.getSound("weird");

            const [usedPath] = vi.mocked(mockFileManager.readStream).mock.calls[0]!;
            expect(usedPath.startsWith(path.resolve(mockConfig.sounds.storagePath) + path.sep)).toBe(true);
        });
    });

    describe("repeated sound cache", () => {
        // Returns the (mocked) premixed stream that getRepeatedSound will cache
        const mockRepeatedSourceStream = (): Readable => {
            vi.mocked(parseAudioSource).mockReturnValue("soundboard");
            vi.mocked(mockSoundRepository.getSoundByName).mockResolvedValue({ name: "test-sound", path: "/test-sound.pcm" });
            vi.mocked(mockFileManager.readStream).mockImplementation(() => Readable.from([Buffer.alloc(960 * 4)]));

            const repeatedStream = new Readable({ read() {} });
            vi.mocked(createRepeatedPcmStream).mockReturnValue(repeatedStream);
            return repeatedStream;
        };

        afterEach(() => {
            vi.useRealTimers();
        });

        it("should return a unique key for every call, even within the same millisecond", async () => {
            vi.mocked(parseAudioSource).mockReturnValue("soundboard");
            vi.mocked(mockSoundRepository.getSoundByName).mockResolvedValue({ name: "test-sound", path: "/test-sound.pcm" });
            vi.mocked(mockFileManager.readStream).mockImplementation(() => Readable.from([Buffer.alloc(960 * 4)]));
            vi.mocked(createRepeatedPcmStream).mockImplementation(() => new Readable({ read() {} }));

            const [first, second] = await Promise.all([soundService.getRepeatedSound(["test-sound"], [0]), soundService.getRepeatedSound(["test-sound"], [0])]);

            expect(first).not.toBeNull();
            expect(second).not.toBeNull();
            expect(first).not.toBe(second);
        });

        it("should hand the cached stream to getSound exactly once", async () => {
            const repeatedStream = mockRepeatedSourceStream();

            const tempName = await soundService.getRepeatedSound(["test-sound"], [0, 100]);
            expect(tempName).not.toBeNull();

            expect(await soundService.getSound(tempName!)).toBe(repeatedStream);

            // A second lookup falls through to the normal soundboard path instead of the cache
            vi.mocked(mockSoundRepository.getSoundByName).mockResolvedValue(null);
            expect(await soundService.getSound(tempName!)).toBeNull();
        });

        it("should evict and destroy an unconsumed repeated sound after the TTL", async () => {
            const repeatedStream = mockRepeatedSourceStream();
            vi.useFakeTimers();

            const tempName = await soundService.getRepeatedSound(["test-sound"], [0, 100]);
            expect(tempName).not.toBeNull();
            expect(repeatedStream.destroyed).toBe(false);

            vi.advanceTimersByTime(REPEATED_SOUND_TTL_MS + 1);

            expect(repeatedStream.destroyed).toBe(true);

            // The entry is gone, so the lookup falls through to the (missing) soundboard sound
            vi.mocked(mockSoundRepository.getSoundByName).mockResolvedValue(null);
            expect(await soundService.getSound(tempName!)).toBeNull();
        });

        it("should not evict a repeated sound that was consumed before the TTL", async () => {
            mockRepeatedSourceStream();
            vi.useFakeTimers();

            const tempName = await soundService.getRepeatedSound(["test-sound"], [0, 100]);
            const stream = (await soundService.getSound(tempName!)) as Readable;

            vi.advanceTimersByTime(REPEATED_SOUND_TTL_MS + 1);

            expect(stream.destroyed).toBe(false);
            expect(vi.getTimerCount()).toBe(0);
        });
    });
});
