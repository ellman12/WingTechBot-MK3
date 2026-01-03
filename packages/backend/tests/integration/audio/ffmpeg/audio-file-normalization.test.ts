import { createFfmpegAudioProcessingService } from "@adapters/services/FfmpegAudioProcessingService.js";
import { createFfmpegService } from "@infrastructure/ffmpeg/FfmpegService.js";
import { access, readFile, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { Readable } from "stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe.concurrent("Audio File Normalization Integration Test", () => {
    const testDir = "./tests/integration/audio";
    const inputFilePath = join(testDir, "test.mp3");
    const outputFilePath = join(testDir, "test-output.pcm");

    let ffmpegAudioService: ReturnType<typeof createFfmpegAudioProcessingService>;
    let tempFiles: string[] = [];

    beforeEach(async () => {
        ffmpegAudioService = createFfmpegAudioProcessingService({
            ffmpeg: createFfmpegService(),
        });

        // Verify test file exists
        try {
            await access(inputFilePath);
        } catch {
            throw new Error(`Test MP3 file not found at ${inputFilePath}. Please ensure test.mp3 exists.`);
        }
    });

    afterEach(async () => {
        // Clean up any temporary files created during tests
        for (const file of tempFiles) {
            try {
                await unlink(file);
            } catch (error) {
                // Ignore cleanup errors
                console.warn(`Failed to cleanup temp file ${file}:`, error);
            }
        }
        tempFiles = [];
    });

    it("should normalize and convert MP3 to Opus format", testNormalizeAndConvertMp3ToOpus, 30000);
    async function testNormalizeAndConvertMp3ToOpus() {
        console.log(`[Test] Starting audio normalization test with input: ${inputFilePath}`);

        // Read the test MP3 file
        const audioInput = await readFile(inputFilePath);
        expect(audioInput).toBeDefined();
        expect(audioInput.length).toBeGreaterThan(0);

        console.log(`[Test] Input file size: ${audioInput.length} bytes`);

        // Process through deepProcessAudio (normalization + Opus conversion)
        const startTime = Date.now();
        const audioOutput = await ffmpegAudioService.deepProcessAudio(audioInput);
        const processingTime = Date.now() - startTime;

        console.log(`[Test] Processing completed in ${processingTime}ms`);
        console.log(`[Test] Output size: ${audioOutput.length} bytes`);

        // Validate output
        expect(audioOutput).toBeDefined();
        expect(audioOutput).toBeInstanceOf(Uint8Array);
        expect(audioOutput.length).toBeGreaterThan(0);

        // Opus files should generally be smaller than MP3 for the same content
        // But this can vary, so we just ensure we got meaningful output
        expect(audioOutput.length).toBeGreaterThan(100); // Minimum reasonable size

        // Write output file for manual verification if needed
        await writeFile(outputFilePath, audioOutput);
        tempFiles.push(outputFilePath);

        console.log(`[Test] Output written to: ${outputFilePath}`);

        // Verify the output file was created successfully
        const outputStats = await readFile(outputFilePath);
        expect(outputStats.length).toBe(audioOutput.length);
    }

    it("should process audio stream in real-time", testProcessAudioStreamRealtime, 30000);
    async function testProcessAudioStreamRealtime() {
        console.log(`[Test] Starting real-time stream processing test`);

        // Read the test file as a stream input
        const audioInput = await readFile(inputFilePath);
        const inputStream = Readable.from([audioInput]);

        // Process through real-time stream processing
        const startTime = Date.now();
        const outputStream = ffmpegAudioService.processAudioStream({
            stream: inputStream,
            formatInfo: {
                format: "mp3",
                container: "mp3",
                codec: "mp3",
                sampleRate: 44100,
                channels: 2,
                bitrate: 128000,
            },
        });

        expect(outputStream).toBeInstanceOf(Readable);

        // Collect output chunks
        const outputChunks: Buffer[] = [];
        let totalBytes = 0;

        for await (const chunk of outputStream) {
            outputChunks.push(chunk);
            totalBytes += chunk.length;
        }

        const processingTime = Date.now() - startTime;
        console.log(`[Test] Stream processing completed in ${processingTime}ms`);

        // Validate stream output
        expect(outputChunks.length).toBeGreaterThan(0);
        expect(totalBytes).toBeGreaterThan(0);

        // Combine chunks and verify
        const finalOutput = Buffer.concat(outputChunks);
        expect(finalOutput.length).toBe(totalBytes);

        // Write stream output for comparison
        const streamOutputPath = join(testDir, "test-stream-output.pcm");
        await writeFile(streamOutputPath, finalOutput);
        tempFiles.push(streamOutputPath);

        console.log(`[Test] Stream output written to: ${streamOutputPath}`);
    }

    it("should handle invalid audio input gracefully", testHandleInvalidAudioInput, 10000);
    async function testHandleInvalidAudioInput() {
        console.log(`[Test] Testing error handling with invalid input`);

        // Test with invalid audio data
        const invalidInput = new Uint8Array([0x00, 0x01, 0x02, 0x03]); // Not valid audio

        await expect(ffmpegAudioService.deepProcessAudio(invalidInput)).rejects.toThrow();
    }

    it("should handle empty input gracefully", testHandleEmptyInput);
    async function testHandleEmptyInput() {
        console.log(`[Test] Testing error handling with empty input`);

        // Test with empty input
        const emptyInput = new Uint8Array(0);

        await expect(ffmpegAudioService.deepProcessAudio(emptyInput)).rejects.toThrow();
    }

    it("should produce consistent output for the same input", testProduceConsistentOutput, 45000);
    async function testProduceConsistentOutput() {
        console.log(`[Test] Testing output consistency`);

        const audioInput = await readFile(inputFilePath);

        // Process the same input twice
        const output1 = await ffmpegAudioService.deepProcessAudio(audioInput);
        const output2 = await ffmpegAudioService.deepProcessAudio(audioInput);

        // Outputs should be identical (deterministic processing)
        expect(output1.length).toBe(output2.length);

        // Note: Due to FFmpeg's loudnorm filter, the outputs might not be
        // byte-for-byte identical, but should be very close in size
        const sizeDifference = Math.abs(output1.length - output2.length);
        const maxAllowedDifference = output1.length * 0.01; // 1% tolerance

        expect(sizeDifference).toBeLessThanOrEqual(maxAllowedDifference);

        console.log(`[Test] Output 1: ${output1.length} bytes`);
        console.log(`[Test] Output 2: ${output2.length} bytes`);
        console.log(`[Test] Size difference: ${sizeDifference} bytes`);
    }
});
