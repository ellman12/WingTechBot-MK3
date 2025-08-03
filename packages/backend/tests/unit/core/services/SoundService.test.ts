import type { SoundRepository } from "@core/repositories/SoundRepository";
import type { AudioFetcherService } from "@core/services/AudioFetcherService";
import type { AudioProcessingService } from "@core/services/AudioProcessingService";
import type { FileManager } from "@core/services/FileManager";
import { createSoundService } from "@core/services/SoundService";
import { Readable } from "stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
const mockAudioFetcher: AudioFetcherService = {
    fetchUrlAudio: vi.fn(),
    parseAudioSource: vi.fn(),
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
    fileExists: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    listFiles: vi.fn(),
};

const mockSoundRepository: SoundRepository = {
    addSound: vi.fn(),
    getSoundByName: vi.fn(),
    getAllSounds: vi.fn(),
    deleteSound: vi.fn(),
};

describe("SoundService", () => {
    let soundService: ReturnType<typeof createSoundService>;

    beforeEach(() => {
        vi.clearAllMocks();
        const deps = {
            audioFetcher: mockAudioFetcher,
            audioProcessor: mockAudioProcessor,
            fileManager: mockFileManager,
            soundRepository: mockSoundRepository,
        };
        soundService = createSoundService(deps);
    });

    describe("addSound", () => {
        it("should successfully add a sound from URL", async () => {
            const testAudio = new Uint8Array([1, 2, 3, 4]);
            const processedAudio = new Uint8Array([5, 6, 7, 8]);
            const mockStream = Readable.from([testAudio]);

            vi.mocked(mockAudioFetcher.fetchUrlAudio).mockResolvedValue(mockStream);
            vi.mocked(mockAudioProcessor.deepProcessAudio).mockResolvedValue(processedAudio);
            vi.mocked(mockFileManager.writeStream).mockResolvedValue(undefined);

            await soundService.addSound("test-sound", "https://example.com/audio.mp3");

            expect(mockAudioFetcher.fetchUrlAudio).toHaveBeenCalledWith("https://example.com/audio.mp3", expect.any(AbortSignal));
            expect(mockAudioProcessor.deepProcessAudio).toHaveBeenCalledWith(Buffer.from(testAudio));
            expect(mockFileManager.writeStream).toHaveBeenCalledWith("./sounds/test-sound.pcm", expect.any(Readable));
            expect(mockSoundRepository.addSound).toHaveBeenCalledWith({
                name: "test-sound",
                path: "/test-sound.pcm",
            });
        });

        it("should handle errors during sound addition", async () => {
            vi.mocked(mockAudioFetcher.fetchUrlAudio).mockRejectedValue(new Error("Network error"));

            await expect(soundService.addSound("test-sound", "bad-url")).rejects.toThrow("Network error");
        });
    });

    describe("getSound", () => {
        it("should return direct file stream for soundboard audio", async () => {
            const mockFileStream = Readable.from(["audio data"]);

            vi.mocked(mockAudioFetcher.parseAudioSource).mockReturnValue("soundboard");
            vi.mocked(mockSoundRepository.getSoundByName).mockResolvedValue({
                name: "test-sound",
                path: "/test-sound.pcm",
            });
            vi.mocked(mockFileManager.readStream).mockReturnValue(mockFileStream);

            const result = await soundService.getSound("test-sound");

            expect(result).toBe(mockFileStream);
            expect(mockSoundRepository.getSoundByName).toHaveBeenCalledWith("test-sound");
            expect(mockFileManager.readStream).toHaveBeenCalledWith("./sounds/test-sound.pcm");
        });

        it("should throw error for non-existent soundboard audio", async () => {
            vi.mocked(mockAudioFetcher.parseAudioSource).mockReturnValue("soundboard");
            vi.mocked(mockSoundRepository.getSoundByName).mockResolvedValue(null);

            await expect(soundService.getSound("non-existent")).rejects.toThrow("Sound with name non-existent not found");
        });

        it("should process and pre-buffer URL/YouTube audio", async () => {
            const mockAudioStream = Readable.from(["raw audio"]);
            const mockProcessedStream = Readable.from(["processed audio"]);

            vi.mocked(mockAudioFetcher.parseAudioSource).mockReturnValue("youtube");
            vi.mocked(mockAudioFetcher.fetchUrlAudio).mockResolvedValue(mockAudioStream);
            vi.mocked(mockAudioProcessor.processAudioStream).mockReturnValue(mockProcessedStream);

            const result = await soundService.getSound("https://youtube.com/watch?v=test");

            expect(mockAudioFetcher.fetchUrlAudio).toHaveBeenCalledWith("https://youtube.com/watch?v=test", undefined);
            expect(mockAudioProcessor.processAudioStream).toHaveBeenCalledWith(mockAudioStream);
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
            expect(mockFileManager.deleteFile).toHaveBeenCalledWith("./sounds/test-sound.pcm");
            expect(mockSoundRepository.deleteSound).toHaveBeenCalledWith("test-sound");
        });

        it("should throw error for non-existent sound", async () => {
            vi.mocked(mockSoundRepository.getSoundByName).mockResolvedValue(null);

            await expect(soundService.deleteSound("non-existent")).rejects.toThrow("Sound with name non-existent not found");
        });
    });
});
