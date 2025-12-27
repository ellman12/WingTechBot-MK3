import { type FfmpegAudioServiceDeps, createFfmpegAudioProcessingService } from "@adapters/services/FfmpegAudioProcessingService";
import type { FfmpegService } from "@infrastructure/ffmpeg/FfmpegService";
import { Readable } from "stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock FFmpeg service
const mockFfmpegService: FfmpegService = {
    run: vi.fn(),
    runStreamAsync: vi.fn(),
    runAsyncStream: vi.fn(),
    runAsync: vi.fn(),
    runAsyncWithStderr: vi.fn(),
    convertAudio: vi.fn(),
    convertStreamToAudio: vi.fn(),
    convertStreamToStream: vi.fn(),
    convertAudioToStream: vi.fn(),
    normalizeAudioStreamRealtime: vi.fn(),
    normalizeAudio: vi.fn(),
};

describe("FfmpegAudioProcessingService", () => {
    let audioProcessingService: ReturnType<typeof createFfmpegAudioProcessingService>;
    let deps: FfmpegAudioServiceDeps;

    beforeEach(() => {
        vi.clearAllMocks();
        deps = {
            ffmpeg: mockFfmpegService,
        };
        audioProcessingService = createFfmpegAudioProcessingService(deps);
    });

    describe("deepProcessAudio", () => {
        it("should normalize and convert audio to PCM", async () => {
            const inputAudio = new Uint8Array([1, 2, 3, 4]);
            const wavAudio = new Uint8Array([5, 6, 7, 8]);
            const normalizedAudio = new Uint8Array([9, 10, 11, 12]);
            const finalAudio = new Uint8Array([13, 14, 15, 16]);

            // First convertAudio call: convert input to WAV
            vi.mocked(mockFfmpegService.convertAudio).mockResolvedValueOnce(wavAudio);
            // normalizeAudio call: normalize the WAV audio
            vi.mocked(mockFfmpegService.normalizeAudio).mockResolvedValue(normalizedAudio);
            // Second convertAudio call: convert normalized WAV to final PCM
            vi.mocked(mockFfmpegService.convertAudio).mockResolvedValueOnce(finalAudio);

            const result = await audioProcessingService.deepProcessAudio(inputAudio);

            // First conversion: input to WAV
            expect(mockFfmpegService.convertAudio).toHaveBeenNthCalledWith(1, inputAudio, {
                inputFormat: undefined,
                outputFormat: "wav",
                codec: "pcm_s16le",
                sampleRate: 48000,
                channels: 2,
            });
            // Normalization: WAV audio with options
            expect(mockFfmpegService.normalizeAudio).toHaveBeenCalledWith(wavAudio, {
                sampleRate: 48000,
                channels: 2,
            });
            // Final conversion: normalized WAV to PCM
            expect(mockFfmpegService.convertAudio).toHaveBeenNthCalledWith(2, normalizedAudio, {
                inputFormat: "wav",
                outputFormat: "s16le",
                codec: "pcm_s16le",
                sampleRate: 48000,
                channels: 2,
            });
            expect(result).toBe(finalAudio);
        });

        it("should handle normalization errors", async () => {
            const inputAudio = new Uint8Array([1, 2, 3, 4]);

            vi.mocked(mockFfmpegService.normalizeAudio).mockRejectedValue(new Error("FFmpeg normalization failed"));

            await expect(audioProcessingService.deepProcessAudio(inputAudio)).rejects.toThrow("FFmpeg normalization failed");
        });
    });

    describe("processAudioStream", () => {
        it("should process audio stream with real-time normalization", () => {
            const inputStream = Readable.from(["audio data"]);
            const mockProcessedStream = Readable.from(["processed audio"]);

            vi.mocked(mockFfmpegService.convertStreamToStream).mockReturnValue(mockProcessedStream);

            const result = audioProcessingService.processAudioStream({
                stream: inputStream,
                formatInfo: {
                    format: "webm",
                    container: "webm",
                    codec: "opus",
                    sampleRate: 48000,
                    channels: 2,
                    bitrate: 128000,
                },
            });

            expect(mockFfmpegService.convertStreamToStream).toHaveBeenCalledWith(inputStream, {
                inputFormat: "webm",
                outputFormat: "s16le",
                codec: "pcm_s16le",
                sampleRate: 48000,
                channels: 2,
                extraArgs: ["-filter:a", "loudnorm=I=-16:TP=-1.5:LRA=11:linear=true"],
            });
            expect(result).toBeInstanceOf(Readable);
        });

        it("should add buffering to processed stream", () => {
            const inputStream = Readable.from(["audio data"]);
            const mockProcessedStream = Readable.from(["processed audio"]);

            vi.mocked(mockFfmpegService.convertStreamToStream).mockReturnValue(mockProcessedStream);

            const result = audioProcessingService.processAudioStream({
                stream: inputStream,
                formatInfo: {
                    format: "webm",
                    container: "webm",
                    codec: "opus",
                    sampleRate: 48000,
                    channels: 2,
                    bitrate: 128000,
                },
            });

            // The result should be a buffered stream (PassThrough stream)
            expect(result).toBeInstanceOf(Readable);
            expect(result.readableHighWaterMark).toBe(256 * 1024); // 256KB buffer
        });

        it("should handle stream processing errors", () => {
            const inputStream = Readable.from(["audio data"]);

            vi.mocked(mockFfmpegService.convertStreamToStream).mockImplementation(() => {
                const errorStream = new Readable({
                    read() {
                        this.destroy(new Error("FFmpeg stream processing failed"));
                    },
                });
                return errorStream;
            });

            const result = audioProcessingService.processAudioStream({
                stream: inputStream,
                formatInfo: {
                    format: "webm",
                    container: "webm",
                    codec: "opus",
                    sampleRate: 48000,
                    channels: 2,
                    bitrate: 128000,
                },
            });

            expect(result).toBeInstanceOf(Readable);

            // The stream should propagate errors
            return new Promise<void>((resolve, reject) => {
                result.on("error", error => {
                    expect(error.message).toBe("FFmpeg stream processing failed");
                    resolve();
                });

                result.on("data", () => {
                    // Should not reach here
                });

                result.on("end", () => {
                    reject(new Error("Stream ended without error"));
                });
            });
        });
    });

    describe("error handling", () => {
        it("should handle FFmpeg spawn failures", async () => {
            const inputAudio = new Uint8Array([1, 2, 3, 4]);

            // Mock spawn failure
            vi.mocked(mockFfmpegService.normalizeAudio).mockRejectedValue(new Error("ffmpeg not found"));

            await expect(audioProcessingService.deepProcessAudio(inputAudio)).rejects.toThrow("ffmpeg not found");
        });

        it("should handle conversion errors", async () => {
            const inputAudio = new Uint8Array([1, 2, 3, 4]);
            const normalizedAudio = new Uint8Array([5, 6, 7, 8]);

            vi.mocked(mockFfmpegService.normalizeAudio).mockResolvedValue(normalizedAudio);
            vi.mocked(mockFfmpegService.convertAudio).mockRejectedValue(new Error("ffmpeg conversion failed"));

            await expect(audioProcessingService.deepProcessAudio(inputAudio)).rejects.toThrow("ffmpeg conversion failed");
        });
    });
});
