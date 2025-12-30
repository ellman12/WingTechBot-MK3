import type { AudioFormatInfo } from "@core/entities/AudioFormatInfo.js";
import type { AudioStreamWithMetadata } from "@core/entities/AudioStream.js";
import { createAudioStreamWithFormat } from "@core/entities/AudioStream.js";
import type { AudioFormatDetectionService } from "@core/services/AudioFormatDetectionService.js";
import { spawn } from "child_process";
import { createReadStream, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { Readable } from "stream";

export interface YtDlpService {
    readonly getAudioStream: (url: string) => Promise<Readable>;
    readonly getAudioStreamWithFormat: (url: string) => Promise<AudioStreamWithMetadata>;
    readonly getVideoInfo: (url: string) => Promise<YtDlpVideoInfo>;
}

export interface YtDlpVideoInfo {
    readonly title: string;
    readonly duration: number;
    readonly uploader: string;
    readonly url: string;
    readonly audioFormat?: string; // e.g., "opus", "aac"
    readonly audioContainer?: string; // e.g., "webm", "m4a"
}

export const createYtDlpService = (formatDetectionService?: AudioFormatDetectionService): YtDlpService => {
    return {
        async getAudioStreamWithFormat(url: string): Promise<AudioStreamWithMetadata> {
            console.log(`[YtDlpService] Getting audio stream with format info for URL: ${url}`);

            const tempFile = join(tmpdir(), `yt-dlp-${Date.now()}-${Math.random().toString(36).substring(7)}.webm`);
            console.log(`[YtDlpService] Downloading to temporary file: ${tempFile}`);

            await new Promise<void>((resolve, reject) => {
                const args = ["--format", "bestaudio", "--output", tempFile, "--no-part", "--no-playlist", "--quiet", url];

                const ytDlpProcess = spawn("yt-dlp", args);

                ytDlpProcess.stderr?.on("data", data => {
                    const errorMsg = data.toString().trim();
                    if (errorMsg && !errorMsg.includes("[download]")) {
                        console.error(`[YtDlpService] yt-dlp stderr: ${errorMsg}`);
                    }
                });

                ytDlpProcess.on("error", error => {
                    console.error(`[YtDlpService] yt-dlp process error: ${error.message}`);
                    try {
                        unlinkSync(tempFile);
                    } catch {
                        // Ignore cleanup errors
                    }
                    reject(error);
                });

                ytDlpProcess.on("close", code => {
                    if (code !== 0) {
                        try {
                            unlinkSync(tempFile);
                        } catch {
                            // Ignore cleanup errors
                        }
                        reject(new Error(`yt-dlp process exited with code ${code}`));
                        return;
                    }
                    resolve();
                });
            });

            if (formatDetectionService) {
                console.log(`[YtDlpService] Probing downloaded file for accurate format info`);
                try {
                    const formatInfo = await formatDetectionService.detectFromFile(tempFile);
                    console.log(`[YtDlpService] Detected format via ffprobe:`, formatInfo);

                    const fileStream = createReadStream(tempFile, {
                        highWaterMark: 256 * 1024,
                    });

                    fileStream.on("end", () => {
                        console.log(`[YtDlpService] Stream ended, cleaning up temp file: ${tempFile}`);
                        try {
                            unlinkSync(tempFile);
                        } catch (e) {
                            console.error(`[YtDlpService] Failed to clean up temp file: ${e}`);
                        }
                    });

                    fileStream.on("error", error => {
                        console.error(`[YtDlpService] File stream error: ${error.message}`);
                        try {
                            unlinkSync(tempFile);
                        } catch {
                            // Ignore cleanup errors
                        }
                    });

                    return createAudioStreamWithFormat(fileStream, formatInfo);
                } catch (error) {
                    console.error(`[YtDlpService] Format detection failed: ${error}`);
                    try {
                        unlinkSync(tempFile);
                    } catch {
                        // Ignore cleanup errors
                    }
                    throw error;
                }
            } else {
                console.warn(`[YtDlpService] No format detection service provided, falling back to video info`);

                const videoInfo = await this.getVideoInfo(url);
                const container = videoInfo.audioContainer || "webm";
                const codec = videoInfo.audioFormat || "opus";
                const format = container === "webm" ? "webm" : container === "m4a" ? "m4a" : container;

                console.log(`[YtDlpService] Detected format from video info: ${format}, container: ${container}, codec: ${codec}`);

                const formatInfo: AudioFormatInfo = {
                    format,
                    container,
                    codec,
                    sampleRate: 48000,
                    channels: 2,
                    bitrate: 0,
                    duration: videoInfo.duration > 0 ? videoInfo.duration : undefined,
                };

                const fileStream = createReadStream(tempFile, {
                    highWaterMark: 256 * 1024,
                });

                fileStream.on("end", () => {
                    try {
                        unlinkSync(tempFile);
                    } catch (e) {
                        console.error(`[YtDlpService] Failed to clean up temp file: ${e}`);
                    }
                });

                return createAudioStreamWithFormat(fileStream, formatInfo);
            }
        },

        async getAudioStream(url: string): Promise<Readable> {
            console.log(`[YtDlpService] Starting audio stream extraction for URL: ${url}`);

            return new Promise((resolve, reject) => {
                const tempFile = join(tmpdir(), `yt-dlp-${Date.now()}-${Math.random().toString(36).substring(7)}.webm`);
                console.log(`[YtDlpService] Using temporary file: ${tempFile}`);

                const args = ["--format", "bestaudio", "--output", tempFile, "--no-part", "--no-playlist", "--quiet", url];

                console.log(`[YtDlpService] Spawning yt-dlp process with args:`, args);
                const ytDlpProcess = spawn("yt-dlp", args, {
                    stdio: ["pipe", "pipe", "pipe"],
                });

                console.log(`[YtDlpService] yt-dlp process spawned successfully with PID: ${ytDlpProcess.pid}`);

                ytDlpProcess.stderr?.on("data", data => {
                    const errorMsg = data.toString().trim();
                    if (errorMsg && !errorMsg.includes("[download]")) {
                        console.error(`[YtDlpService] yt-dlp stderr: ${errorMsg}`);
                    }
                });

                ytDlpProcess.on("error", error => {
                    console.error(`[YtDlpService] yt-dlp process error: ${error.message}`);
                    try {
                        unlinkSync(tempFile);
                    } catch {
                        // Ignore cleanup errors
                    }
                    reject(error);
                });

                ytDlpProcess.on("close", code => {
                    console.log(`[YtDlpService] yt-dlp process closed with code: ${code}`);

                    if (code !== 0) {
                        const error = new Error(`yt-dlp process exited with code ${code}`);
                        console.error(`[YtDlpService] ${error.message}`);
                        try {
                            unlinkSync(tempFile);
                        } catch {
                            // Ignore cleanup errors
                        }
                        reject(error);
                        return;
                    }

                    console.log(`[YtDlpService] Creating read stream from temp file: ${tempFile}`);
                    try {
                        const fileStream = createReadStream(tempFile, {
                            highWaterMark: 256 * 1024,
                        });

                        fileStream.on("end", () => {
                            console.log(`[YtDlpService] Stream ended, cleaning up temp file: ${tempFile}`);
                            try {
                                unlinkSync(tempFile);
                            } catch (e) {
                                console.error(`[YtDlpService] Failed to clean up temp file: ${e}`);
                            }
                        });

                        fileStream.on("error", error => {
                            console.error(`[YtDlpService] File stream error: ${error.message}`);
                            try {
                                unlinkSync(tempFile);
                            } catch {
                                // Ignore cleanup errors
                            }
                        });

                        console.log(`[YtDlpService] Returning file stream for URL: ${url}`);
                        resolve(fileStream);
                    } catch (error) {
                        console.error(`[YtDlpService] Failed to create read stream: ${error}`);
                        try {
                            unlinkSync(tempFile);
                        } catch {
                            // Ignore cleanup errors
                        }
                        reject(error);
                    }
                });
            });
        },

        async getVideoInfo(url: string): Promise<YtDlpVideoInfo> {
            console.log(`[YtDlpService] Getting video info for URL: ${url}`);

            return new Promise((resolve, reject) => {
                const args = ["--dump-json", "--no-download", url];
                console.log(`[YtDlpService] Spawning yt-dlp for video info with args:`, args);

                const ytDlpProcess = spawn("yt-dlp", args);

                let output = "";

                ytDlpProcess.stdout?.on("data", data => {
                    const chunk = data.toString();
                    output += chunk;
                    console.log(`[YtDlpService] Received video info data chunk: ${chunk.length} chars`);
                });

                ytDlpProcess.stderr?.on("data", data => {
                    const errorMsg = data.toString().trim();
                    console.error(`[YtDlpService] yt-dlp video info stderr: ${errorMsg}`);
                });

                ytDlpProcess.on("error", error => {
                    console.error(`[YtDlpService] yt-dlp video info process error: ${error.message}`);
                    reject(error);
                });

                ytDlpProcess.on("close", code => {
                    console.log(`[YtDlpService] yt-dlp video info process closed with code: ${code}`);

                    if (code !== 0) {
                        const error = new Error(`yt-dlp video info process exited with code ${code}`);
                        console.error(`[YtDlpService] ${error.message}`);
                        reject(error);
                        return;
                    }

                    console.log(`[YtDlpService] Raw video info output length: ${output.length} chars`);

                    try {
                        const videoData = JSON.parse(output);

                        let audioContainer: string | undefined;
                        let audioFormat: string | undefined;

                        if (videoData.requested_formats && Array.isArray(videoData.requested_formats)) {
                            const audioFormatData = videoData.requested_formats.find((f: { acodec?: string; ext?: string }) => f.acodec !== "none");
                            if (audioFormatData) {
                                audioContainer = audioFormatData.ext;
                                audioFormat = audioFormatData.acodec;
                            }
                        } else {
                            audioContainer = videoData.ext;
                            audioFormat = videoData.acodec;
                        }

                        const result = {
                            title: videoData.title || "Unknown Title",
                            duration: videoData.duration || 0,
                            uploader: videoData.uploader || "Unknown Uploader",
                            url: url,
                            audioContainer,
                            audioFormat,
                        };

                        console.log(`[YtDlpService] Parsed video info:`, {
                            title: result.title,
                            duration: result.duration,
                            uploader: result.uploader,
                            url: result.url,
                            audioContainer: result.audioContainer,
                            audioFormat: result.audioFormat,
                        });

                        resolve(result);
                    } catch (parseError) {
                        const errorMsg = `Failed to parse yt-dlp JSON output: ${parseError}`;
                        console.error(`[YtDlpService] ${errorMsg}`);
                        console.error(`[YtDlpService] Raw output that failed to parse:`, output.substring(0, 500));
                        reject(new Error(errorMsg));
                    }
                });
            });
        },
    };
};
