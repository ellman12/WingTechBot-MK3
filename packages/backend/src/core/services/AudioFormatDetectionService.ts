import { randomUUID } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Readable } from "stream";

import type { FfprobeService } from "../../infrastructure/ffmpeg/FfprobeService.js";
import type { AudioFormatInfo } from "../entities/AudioFormatInfo.js";
import { isValidAudioFormat } from "../entities/AudioFormatInfo.js";
import { CorruptedAudioError, FormatDetectionError, UnsupportedFormatError } from "../errors/AudioErrors.js";

// Detects audio format using ffprobe before processing to prevent FFmpeg inference errors.
// Supports files, URLs, and streams (with buffering).
export class AudioFormatDetectionService {
    constructor(private readonly ffprobeService: FfprobeService) {}

    // Detect audio format from a file path.
    async detectFromFile(filePath: string): Promise<AudioFormatInfo> {
        console.log("[AudioFormatDetection] Detecting format from file", { filePath });

        try {
            const output = await this.ffprobeService.probeAudio(filePath);
            return this.parseFormatInfo(output, { filePath });
        } catch (error) {
            if (error instanceof FormatDetectionError || error instanceof CorruptedAudioError) {
                throw error;
            }

            throw new FormatDetectionError(`Failed to detect format from file: ${error instanceof Error ? error.message : "Unknown error"}`, { filePath });
        }
    }

    // Detect audio format from a URL.
    async detectFromUrl(url: string, timeout: number = 30000): Promise<AudioFormatInfo> {
        console.log("[AudioFormatDetection] Detecting format from URL", { url });

        try {
            const output = await this.ffprobeService.probeAudio(url, timeout);
            return this.parseFormatInfo(output, { url });
        } catch (error) {
            if (error instanceof FormatDetectionError) {
                throw error;
            }

            throw new FormatDetectionError(`Failed to detect format from URL: ${error instanceof Error ? error.message : "Unknown error"}`, { url });
        }
    }

    // Detect audio format from a stream.
    // NOTE: This method must buffer the stream to a temporary file to probe it,
    // as ffprobe cannot probe streams directly. For large streams, consider
    // using detectFromUrl if the source is a URL.
    async detectFromStream(stream: Readable, maxSizeBytes: number = 100 * 1024 * 1024): Promise<AudioFormatInfo> {
        console.log("[AudioFormatDetection] Detecting format from stream", { maxSizeBytes });

        let tempFilePath: string | null = null;

        try {
            // Create temporary file
            tempFilePath = path.join(os.tmpdir(), `ffprobe-${randomUUID()}.tmp`);

            // Buffer stream to temp file with size limit
            await this.writeStreamToFile(stream, tempFilePath, maxSizeBytes);

            // Probe the temp file
            const format = await this.detectFromFile(tempFilePath);

            console.log("[AudioFormatDetection] Format detected from stream", { format });

            return format;
        } catch (error) {
            if (error instanceof FormatDetectionError || error instanceof CorruptedAudioError) {
                throw error;
            }

            throw new FormatDetectionError(`Failed to detect format from stream: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            // Clean up temp file
            if (tempFilePath) {
                try {
                    await fs.promises.unlink(tempFilePath);
                } catch {
                    // Ignore cleanup errors
                }
            }
        }
    }

    // Fast format detection using minimal data.
    // Useful for quick validation before full processing.
    async detectFast(input: string): Promise<AudioFormatInfo> {
        console.log("[AudioFormatDetection] Fast format detection", { input });

        try {
            const output = await this.ffprobeService.probeFast(input);
            return this.parseFormatInfo(output, { filePath: input });
        } catch (error) {
            throw new FormatDetectionError(`Fast detection failed: ${error instanceof Error ? error.message : "Unknown error"}`, { filePath: input });
        }
    }

    // Parse ffprobe output into AudioFormatInfo.
    // Validates that audio stream exists and extracts metadata.
    private parseFormatInfo(output: Awaited<ReturnType<FfprobeService["probe"]>>, context: { filePath?: string; url?: string }): AudioFormatInfo {
        // Find audio stream
        const audioStream = output.streams?.find(s => s.codec_type === "audio");

        if (!audioStream) {
            throw new FormatDetectionError("No audio stream found in input", context);
        }

        // Validate we have format information
        if (!output.format) {
            throw new FormatDetectionError("No format information found in input", context);
        }

        // Extract primary format name (first in comma-separated list)
        const formatName = output.format.format_name.split(",")[0];

        // Parse numeric fields
        const sampleRate = audioStream.sample_rate ? parseInt(audioStream.sample_rate, 10) : 0;
        const channels = audioStream.channels || 0;
        const bitrate = parseInt(audioStream.bit_rate || output.format.bit_rate || "0", 10);
        const duration = parseFloat(audioStream.duration || output.format.duration || "0");

        // Build format info
        const formatInfo: Partial<AudioFormatInfo> = {
            format: formatName,
            container: output.format.format_name,
            codec: audioStream.codec_name,
            sampleRate,
            channels,
            bitrate,
            duration: duration > 0 ? duration : undefined,
            channelLayout: audioStream.channel_layout,
            bitDepth: audioStream.bits_per_sample,
        };

        // Validate required fields
        if (!isValidAudioFormat(formatInfo)) {
            throw new CorruptedAudioError("Audio stream exists but has invalid/missing metadata. File may be corrupted.", context);
        }

        // Check for unsupported formats
        if (audioStream.codec_name === "unknown" || formatName === "unknown") {
            throw new UnsupportedFormatError("Unsupported or unknown audio format", {
                format: formatName,
                codec: audioStream.codec_name,
            });
        }

        console.log("[AudioFormatDetection] Format parsed successfully", {
            formatInfo,
            context,
        });

        return formatInfo;
    }

    // Write stream to file with size limit.
    // Throws if stream exceeds maxSizeBytes.
    private async writeStreamToFile(stream: Readable, filePath: string, maxSizeBytes: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const writeStream = fs.createWriteStream(filePath);
            let bytesWritten = 0;

            stream.on("data", (chunk: Buffer) => {
                bytesWritten += chunk.length;

                if (bytesWritten > maxSizeBytes) {
                    stream.destroy();
                    writeStream.destroy();
                    reject(
                        new FormatDetectionError(`Stream exceeds size limit of ${maxSizeBytes} bytes`, {
                            filePath,
                        })
                    );
                }
            });

            stream.on("error", error => {
                writeStream.destroy();
                reject(error);
            });

            writeStream.on("error", (error: Error) => {
                stream.destroy();
                reject(error);
            });

            writeStream.on("finish", () => {
                resolve();
            });

            stream.pipe(writeStream);
        });
    }
}
