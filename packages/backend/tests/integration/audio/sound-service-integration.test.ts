import { createFfmpegAudioProcessingService } from "@adapters/services/FfmpegAudioProcessingService.js";
import type { AudioStreamWithMetadata } from "@core/entities/AudioStream.js";
import { createAudioStreamWithFormat } from "@core/entities/AudioStream.js";
import type { Sound } from "@core/entities/Sound.js";
import type { SoundRepository } from "@core/repositories/SoundRepository.js";
import type { AudioFetcherService } from "@core/services/AudioFetcherService.js";
import { createSoundService } from "@core/services/SoundService.js";
import { createFfmpegService } from "@infrastructure/ffmpeg/FfmpegService.js";
import { createFileManager } from "@infrastructure/filestore/FileManager.js";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import assert from "node:assert";
import { tmpdir } from "os";
import { join } from "path";
import { Readable } from "stream";
import { describe, expect, it, vi } from "vitest";

import { getTestConfig } from "../../setup.js";

describe.concurrent("SoundService Integration Tests", () => {
    // Use a factory function to create isolated test context for each test
    const createTestContext = () => {
        const tempDir = mkdtempSync(join(tmpdir(), "sound-service-test-"));

        // Create fresh audio fetcher for this test to avoid shared state
        const mockAudioFetcher: AudioFetcherService = {
            fetchSoundboardAudio: vi.fn(),
            fetchUrlAudio: async (url: string): Promise<AudioStreamWithMetadata> => {
                // Return the test MP3 file as a stream for URL requests
                if (url.startsWith("http")) {
                    const testDir = "./tests/integration/audio";
                    const testFilePath = join(testDir, "test.mp3");
                    const fileBuffer = readFileSync(testFilePath);
                    // Clone buffer to avoid sharing between concurrent tests
                    return createAudioStreamWithFormat(Readable.from([Buffer.from(fileBuffer)]), {
                        format: "mp3",
                        container: "mp3",
                        codec: "mp3",
                        sampleRate: 44100,
                        channels: 2,
                        bitrate: 128000,
                    });
                }
                throw new Error("Invalid URL");
            },
        };

        // Create fresh repository for this test to avoid concurrent interference
        const soundsMap = new Map<string, { name: string; path: string }>();
        const mockSoundRepository: { sounds: Map<string, { name: string; path: string }> } & SoundRepository = {
            sounds: soundsMap,

            async addSound(sound: { name: string; path: string }): Promise<Sound> {
                soundsMap.set(sound.name, sound);
                return sound;
            },

            async getSoundByName(name: string): Promise<{ name: string; path: string } | null> {
                return soundsMap.get(name) || null;
            },

            async getAllSounds(): Promise<{ name: string; path: string }[]> {
                return Array.from(soundsMap.values());
            },

            async deleteSound(name: string): Promise<void> {
                soundsMap.delete(name);
            },

            async getAllSoundsWithTagName(_name: string): Promise<Sound[]> {
                return [];
            },

            async tryGetSoundsWithinDistance(): Promise<(Sound & { distance: number })[]> {
                return [];
            },
        };

        // Create test config with unique temp directory
        const baseConfig = getTestConfig();
        const testConfig = {
            ...baseConfig,
            sounds: { storagePath: tempDir },
            cache: { ...baseConfig.cache, audioDownloadPath: join(tempDir, "cache") },
        };

        // Create services
        const ffmpegService = createFfmpegService();
        const audioProcessor = createFfmpegAudioProcessingService({ ffmpeg: ffmpegService });
        const fileManager = createFileManager();

        const soundService = createSoundService({
            audioFetcher: mockAudioFetcher,
            audioProcessor,
            fileManager,
            soundRepository: mockSoundRepository,
            config: testConfig,
        });

        return { soundService, tempDir, mockSoundRepository, mockAudioFetcher, testConfig };
    };

    const cleanupTestContext = async (tempDir: string) => {
        // Give async operations a moment to complete
        await new Promise(resolve => setTimeout(resolve, 50));

        // Clean up entire temp directory
        try {
            if (existsSync(tempDir)) {
                rmSync(tempDir, { recursive: true, force: true });
            }
        } catch (error) {
            console.warn(`Failed to delete temp directory ${tempDir}:`, error);
        }
    };

    it("should successfully add and retrieve a sound from URL", testAddAndRetrieveSoundFromUrl, 30000);
    async function testAddAndRetrieveSoundFromUrl() {
        const ctx = createTestContext();
        try {
            const testUrl = "https://example.com/test-audio.mp3";
            const soundName = "integration-test-sound";

            // Add the sound
            await ctx.soundService.addSound(soundName, testUrl);

            // Track the created file for cleanup
            const expectedPath = `${ctx.tempDir}/${soundName}.pcm`;

            // Verify the sound was added to repository
            const savedSound = await ctx.mockSoundRepository.getSoundByName(soundName);
            expect(savedSound).not.toBeNull();
            expect(savedSound?.name).toBe(soundName);
            expect(savedSound?.path).toBe(`/${soundName}.pcm`);

            // Verify the file was created
            expect(existsSync(expectedPath)).toBe(true);

            // Retrieve the sound
            const audioStream = await ctx.soundService.getSound(soundName);
            expect(audioStream).toBeInstanceOf(Readable);
            assert(audioStream instanceof Readable);

            // Verify we can read data from the stream
            const chunks: Buffer[] = [];
            for await (const chunk of audioStream) {
                chunks.push(chunk);
            }

            const audioData = Buffer.concat(chunks);
            expect(audioData.length).toBeGreaterThan(0);
        } finally {
            await cleanupTestContext(ctx.tempDir);
        }
    }

    it("should list sounds correctly", testListSounds, 45000);
    async function testListSounds() {
        const ctx = createTestContext();
        try {
            const soundName1 = "test-sound-1";
            const soundName2 = "test-sound-2";
            const testUrl = "https://example.com/test-audio.mp3";

            // Initially should be empty
            let sounds = await ctx.soundService.listSounds();
            expect(sounds).toEqual([]);

            // Add first sound
            await ctx.soundService.addSound(soundName1, testUrl);

            sounds = await ctx.soundService.listSounds();
            expect(sounds).toEqual([soundName1]);

            // Add second sound
            await ctx.soundService.addSound(soundName2, testUrl);

            sounds = await ctx.soundService.listSounds();
            expect(sounds).toHaveLength(2);
            expect(sounds).toContain(soundName1);
            expect(sounds).toContain(soundName2);
        } finally {
            await cleanupTestContext(ctx.tempDir);
        }
    }

    it("should delete sounds correctly", testDeleteSounds, 30000);
    async function testDeleteSounds() {
        const ctx = createTestContext();
        try {
            const soundName = "test-delete-sound";
            const testUrl = "https://example.com/test-audio.mp3";

            // Add the sound
            await ctx.soundService.addSound(soundName, testUrl);
            const filePath = `${ctx.tempDir}/${soundName}.pcm`;

            // Verify it exists
            expect(existsSync(filePath)).toBe(true);
            expect(await ctx.mockSoundRepository.getSoundByName(soundName)).not.toBeNull();

            // Delete the sound
            await ctx.soundService.deleteSound(soundName);

            // Verify it's gone
            expect(existsSync(filePath)).toBe(false);
            expect(await ctx.mockSoundRepository.getSoundByName(soundName)).toBeNull();
        } finally {
            await cleanupTestContext(ctx.tempDir);
        }
    }

    it("should handle URL audio streams with processing", testHandleUrlAudioStreams, 30000);
    async function testHandleUrlAudioStreams() {
        const ctx = createTestContext();
        try {
            const testUrl = "https://example.com/streaming-audio.mp3";

            // Get audio stream (should be processed through FFmpeg)
            const audioStream = await ctx.soundService.getSound(testUrl);
            expect(audioStream).toBeInstanceOf(Readable);
            assert(audioStream instanceof Readable);

            // Verify we can read processed data
            const chunks: Buffer[] = [];
            for await (const chunk of audioStream) {
                chunks.push(chunk);
            }

            const processedData = Buffer.concat(chunks);
            expect(processedData.length).toBeGreaterThan(0);
        } finally {
            await cleanupTestContext(ctx.tempDir);
        }
    }

    it("should handle errors gracefully", testHandleErrors);
    async function testHandleErrors() {
        const ctx = createTestContext();
        try {
            // Test with invalid URL
            await expect(ctx.soundService.addSound("bad-sound", "not-a-url")).rejects.toThrow();

            // Test getting non-existent soundboard sound
            const result = await ctx.soundService.getSound("non-existent-sound");
            expect(result).toBeNull();

            // Test deleting non-existent sound
            await expect(ctx.soundService.deleteSound("non-existent-sound")).rejects.toThrow("Sound with name non-existent-sound not found");
        } finally {
            await cleanupTestContext(ctx.tempDir);
        }
    }
});
