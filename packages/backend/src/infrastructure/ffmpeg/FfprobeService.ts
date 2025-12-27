import { execFile } from "child_process";
import { promisify } from "util";

import type { Config } from "../config/Config.js";

const execFileAsync = promisify(execFile);

/**
 * Raw ffprobe output structure for format information
 */
type FfprobeFormat = {
    format_name: string;
    format_long_name: string;
    duration?: string;
    size?: string;
    bit_rate?: string;
    probe_score?: number;
    tags?: Record<string, string>;
};

/**
 * Raw ffprobe output structure for stream information
 */
type FfprobeStream = {
    index: number;
    codec_name: string;
    codec_long_name: string;
    codec_type: string;
    codec_tag_string: string;
    sample_rate?: string;
    channels?: number;
    channel_layout?: string;
    bits_per_sample?: number;
    bit_rate?: string;
    duration?: string;
    tags?: Record<string, string>;
};

/**
 * Complete ffprobe output structure
 */
type FfprobeOutput = {
    streams?: FfprobeStream[];
    format?: FfprobeFormat;
    error?: {
        code: number;
        string: string;
    };
};

/**
 * Low-level FFprobe service for probing media files and streams.
 *
 * This service wraps the ffprobe command-line tool to extract format
 * and stream metadata from audio/video files. It provides structured
 * JSON output for programmatic parsing.
 *
 * Usage:
 *   const probe = await ffprobeService.probe('/path/to/audio.mp3');
 *   console.log(probe.format.format_name); // 'mp3'
 */
export class FfprobeService {
    private readonly ffprobePath: string;

    constructor(config: Config) {
        this.ffprobePath = config.ffmpeg.ffprobePath || "ffprobe";
    }

    /**
     * Probe a media file or URL and return raw ffprobe output.
     *
     * @param input - File path or URL to probe
     * @param options - Additional options for probing
     * @returns Parsed ffprobe output with format and stream information
     * @throws Error if ffprobe execution fails or returns error
     */
    async probe(
        input: string,
        options: {
            /**
             * Select specific streams (e.g., 'a:0' for first audio stream)
             */
            selectStreams?: string;

            /**
             * Maximum time in microseconds to analyze for probing (default: 5000000 = 5s)
             */
            analyzeDuration?: number;

            /**
             * Maximum size in bytes to probe (default: unlimited)
             */
            probeSize?: number;

            /**
             * Timeout for probe operation in milliseconds (default: 30000 = 30s)
             */
            timeout?: number;
        } = {}
    ): Promise<FfprobeOutput> {
        const args = [
            "-v",
            "quiet", // Suppress logs
            "-print_format",
            "json", // JSON output
            "-show_format", // Include format info
            "-show_streams", // Include stream info
            "-show_error", // Include error info if probe fails
        ];

        // Add optional stream selection
        if (options.selectStreams) {
            args.push("-select_streams", options.selectStreams);
        }

        // Add optional analyze duration (how much data to read)
        if (options.analyzeDuration) {
            args.push("-analyzeduration", options.analyzeDuration.toString());
        }

        // Add optional probe size (max bytes to read)
        if (options.probeSize) {
            args.push("-probesize", options.probeSize.toString());
        }

        // Add input file/URL
        args.push(input);

        const timeout = options.timeout || 30000; // 30 second default

        try {
            console.log(`[FfprobeService] Probing: ${input}`, { args });

            const { stdout, stderr } = await execFileAsync(this.ffprobePath, args, {
                timeout,
                maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large metadata
            });

            // Parse JSON output
            const output: FfprobeOutput = JSON.parse(stdout);

            // Check if ffprobe returned an error
            if (output.error) {
                console.error("[FfprobeService] Probe returned error", {
                    input,
                    error: output.error,
                });
                throw new Error(`ffprobe error: ${output.error.string} (code: ${output.error.code})`);
            }

            // Log any stderr output (warnings)
            if (stderr) {
                console.log("[FfprobeService] Probe stderr", { stderr });
            }

            return output;
        } catch (error) {
            // Handle execution errors
            if (error instanceof Error) {
                if ("killed" in error && error.killed) {
                    throw new Error(`ffprobe timeout after ${timeout}ms for input: ${input}`);
                }

                console.error("[FfprobeService] Probe execution failed", {
                    input,
                    error: error.message,
                    stack: error.stack,
                });
            }

            throw new Error(`ffprobe failed for input ${input}: ${error}`);
        }
    }

    /**
     * Quick probe focusing only on audio streams.
     * More efficient than full probe when only audio metadata is needed.
     *
     * @param input - File path or URL to probe
     * @param timeout - Timeout in milliseconds (default: 30000)
     * @returns Ffprobe output with only audio stream(s)
     */
    async probeAudio(input: string, timeout?: number): Promise<FfprobeOutput> {
        return this.probe(input, {
            selectStreams: "a", // Only audio streams
            timeout,
        });
    }

    /**
     * Probe a stream or file with limited data reading.
     * Useful for large files or streams where you only need format info.
     *
     * @param input - File path or URL to probe
     * @param maxBytes - Maximum bytes to read (default: 1MB)
     * @returns Ffprobe output with partial data
     */
    async probeFast(input: string, maxBytes: number = 1024 * 1024): Promise<FfprobeOutput> {
        return this.probe(input, {
            probeSize: maxBytes,
            analyzeDuration: 1000000, // 1 second
            timeout: 10000, // 10 second timeout for fast probe
        });
    }
}
