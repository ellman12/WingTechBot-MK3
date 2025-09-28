import { createFfmpegAudioProcessingService } from "@adapters/services/FfmpegAudioProcessingService";
import type { Sound } from "@core/entities/Sound";
import type { AudioFetcherService } from "@core/services/AudioFetcherService";
import { createSoundService } from "@core/services/SoundService";
import { createFfmpegService } from "@infrastructure/ffmpeg/FfmpegService";
import { createFileManager } from "@infrastructure/filestore/FileManager";
import { existsSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { Readable } from "stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock implementations for integration testing
const mockAudioFetcher: AudioFetcherService = {
    fetchSoundboardAudio: vi.fn(),
    fetchUrlAudio: async (url: string): Promise<Readable> => {
        // Return the test MP3 file as a stream for URL requests
        if (url.startsWith("http")) {
            const testDir = "./tests/integration/audio";
            const testFilePath = join(testDir, "test.mp3");
            const fileBuffer = readFileSync(testFilePath);
            return Readable.from([fileBuffer]);
        }
        throw new Error("Invalid URL");
    },
    parseAudioSource: (source: string): "soundboard" | "url" | "youtube" => {
        if (source.startsWith("http://") || source.startsWith("https://")) {
            return source.includes("youtube.com") || source.includes("youtu.be") ? "youtube" : "url";
        }
        return "soundboard";
    },
};

const mockSoundRepository = {
    sounds: new Map<string, { name: string; path: string }>(),

    async addSound(sound: { name: string; path: string }): Promise<Sound> {
        this.sounds.set(sound.name, sound);

        return sound;
    },

    async getSoundByName(name: string): Promise<{ name: string; path: string } | null> {
        return this.sounds.get(name) || null;
    },

    async getAllSounds(): Promise<{ name: string; path: string }[]> {
        return Array.from(this.sounds.values());
    },

    async deleteSound(name: string): Promise<void> {
        this.sounds.delete(name);
    },

    async getAllSoundsWithTagName(_name: string): Promise<Sound[]> {
        return []
    }
};

describe("SoundService Integration Tests", () => {
    let soundService: ReturnType<typeof createSoundService>;
    let tempFiles: string[] = [];

    beforeEach(() => {
        // Clear the mock repository
        mockSoundRepository.sounds.clear();

        // Create services
        const ffmpegService = createFfmpegService();
        const audioProcessor = createFfmpegAudioProcessingService({ ffmpeg: ffmpegService });
        const fileManager = createFileManager();

        soundService = createSoundService({
            audioFetcher: mockAudioFetcher,
            audioProcessor,
            fileManager,
            soundRepository: mockSoundRepository,
        });
    });

    afterEach(() => {
        // Clean up temporary files
        tempFiles.forEach(file => {
            if (existsSync(file)) {
                try {
                    unlinkSync(file);
                } catch (error) {
                    console.warn(`Failed to delete temp file ${file}:`, error);
                }
            }
        });
        tempFiles = [];
    });

    it("should successfully add and retrieve a sound from URL", async () => {
        const testUrl = "https://example.com/test-audio.mp3";
        const soundName = "integration-test-sound";

        // Add the sound
        await soundService.addSound(soundName, testUrl);

        // Track the created file for cleanup
        const expectedPath = `./sounds/${soundName}.pcm`;
        tempFiles.push(expectedPath);

        // Verify the sound was added to repository
        const savedSound = await mockSoundRepository.getSoundByName(soundName);
        expect(savedSound).not.toBeNull();
        expect(savedSound?.name).toBe(soundName);
        expect(savedSound?.path).toBe(`/${soundName}.pcm`);

        // Verify the file was created
        expect(existsSync(expectedPath)).toBe(true);

        // Retrieve the sound
        const audioStream = await soundService.getSound(soundName);
        expect(audioStream).toBeInstanceOf(Readable);

        // Verify we can read data from the stream
        const chunks: Buffer[] = [];
        for await (const chunk of audioStream) {
            chunks.push(chunk);
        }

        const audioData = Buffer.concat(chunks);
        expect(audioData.length).toBeGreaterThan(0);
    }, 30000); // Increase timeout for FFmpeg processing

    it("should list sounds correctly", async () => {
        const soundName1 = "test-sound-1";
        const soundName2 = "test-sound-2";
        const testUrl = "https://example.com/test-audio.mp3";

        // Initially should be empty
        let sounds = await soundService.listSounds();
        expect(sounds).toEqual([]);

        // Add first sound
        await soundService.addSound(soundName1, testUrl);
        tempFiles.push(`./sounds/${soundName1}.pcm`);

        sounds = await soundService.listSounds();
        expect(sounds).toEqual([soundName1]);

        // Add second sound
        await soundService.addSound(soundName2, testUrl);
        tempFiles.push(`./sounds/${soundName2}.pcm`);

        sounds = await soundService.listSounds();
        expect(sounds).toHaveLength(2);
        expect(sounds).toContain(soundName1);
        expect(sounds).toContain(soundName2);
    }, 45000);

    it("should delete sounds correctly", async () => {
        const soundName = "test-delete-sound";
        const testUrl = "https://example.com/test-audio.mp3";

        // Add the sound
        await soundService.addSound(soundName, testUrl);
        const filePath = `./sounds/${soundName}.pcm`;

        // Verify it exists
        expect(existsSync(filePath)).toBe(true);
        expect(await mockSoundRepository.getSoundByName(soundName)).not.toBeNull();

        // Delete the sound
        await soundService.deleteSound(soundName);

        // Verify it's gone
        expect(existsSync(filePath)).toBe(false);
        expect(await mockSoundRepository.getSoundByName(soundName)).toBeNull();
    }, 30000);

    it("should handle URL audio streams with processing", async () => {
        const testUrl = "https://example.com/streaming-audio.mp3";

        // Get audio stream (should be processed through FFmpeg)
        const audioStream = await soundService.getSound(testUrl);
        expect(audioStream).toBeInstanceOf(Readable);

        // Verify we can read processed data
        const chunks: Buffer[] = [];
        for await (const chunk of audioStream) {
            chunks.push(chunk);
        }

        const processedData = Buffer.concat(chunks);
        expect(processedData.length).toBeGreaterThan(0);
    }, 30000);

    it("should handle errors gracefully", async () => {
        // Test with invalid URL
        await expect(soundService.addSound("bad-sound", "not-a-url")).rejects.toThrow();

        // Test getting non-existent soundboard sound
        await expect(soundService.getSound("non-existent-sound")).rejects.toThrow("Sound with name non-existent-sound not found");

        // Test deleting non-existent sound
        await expect(soundService.deleteSound("non-existent-sound")).rejects.toThrow("Sound with name non-existent-sound not found");
    });
});
