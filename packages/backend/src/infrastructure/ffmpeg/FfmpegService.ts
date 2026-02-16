import ffmpeg from "fluent-ffmpeg";
import type { FfmpegCommand } from "fluent-ffmpeg";
import { PassThrough, Readable } from "stream";

export type FfmpegConvertOptions = {
    readonly inputFormat?: string; // Input format (e.g., 'wav', 'mp3')
    readonly outputFormat: string; // Output format (e.g., 'wav', 'mp3')
    readonly sampleRate?: number; // Sample rate in Hz (e.g., 44100)
    readonly channels?: number; // Number of audio channels (e.g., 1 for mono, 2 for stereo)
    readonly codec: string; // Audio codec (e.g., 'libopus', 'aac')
    readonly bitrate?: string; // Bitrate (e.g., '128k', '256k')
    readonly extraArgs?: string[]; // Additional FFmpeg arguments
};

export type FfmpegService = {
    readonly convertAudio: (input: Uint8Array, options: FfmpegConvertOptions) => Promise<Uint8Array>;
    readonly convertStreamToStream: (inputStream: Readable, options: FfmpegConvertOptions) => Readable;
};

export const createFfmpegService = (): FfmpegService => {
    // Create a fluent-ffmpeg command with optimized settings for real-time streaming
    const createCommand = (inputStream: Readable, options?: { inputFormat?: string }): FfmpegCommand => {
        const cmd = ffmpeg(inputStream)
            // Real-time streaming optimizations
            .addOutputOptions([
                "-fflags",
                "+genpts+igndts", // Generate timestamps and ignore input timestamps
                "-avoid_negative_ts",
                "make_zero", // Avoid timing issues
                "-max_muxing_queue_size",
                "1024", // Larger muxing queue for streaming
                "-preset",
                "ultrafast", // Fastest encoding preset
                "-tune",
                "zerolatency", // Optimize for real-time streaming
            ])
            .on("error", (err, stdout, stderr) => {
                console.error("[FfmpegService] FFmpeg error:", err.message);
                if (stderr) {
                    console.error("[FfmpegService] FFmpeg stderr:", stderr);
                }
            })
            .on("stderr", stderrLine => {
                // Only log actual errors, not progress info
                if (stderrLine && !stderrLine.includes("frame=") && !stderrLine.includes("size=")) {
                    console.error("[FfmpegService] FFmpeg:", stderrLine);
                }
            });

        // Set input format if specified
        if (options?.inputFormat) {
            cmd.inputFormat(options.inputFormat);
        }

        return cmd;
    };

    // Apply conversion options to a fluent-ffmpeg command
    const applyConvertOptions = (cmd: FfmpegCommand, options: FfmpegConvertOptions): FfmpegCommand => {
        if (options.codec) {
            cmd.audioCodec(options.codec);
        }
        if (options.sampleRate) {
            cmd.audioFrequency(options.sampleRate);
        }
        if (options.channels) {
            cmd.audioChannels(options.channels);
        }
        if (options.bitrate) {
            cmd.audioBitrate(options.bitrate);
        }
        if (options.extraArgs && options.extraArgs.length > 0) {
            cmd.addOutputOptions(options.extraArgs);
        }
        if (options.outputFormat) {
            cmd.format(options.outputFormat);
        }

        return cmd;
    };

    // Convert audio buffer with specified options
    const convertAudio = async (input: Uint8Array, options: FfmpegConvertOptions): Promise<Uint8Array> => {
        const inputStream = Readable.from([input]);

        return new Promise((resolve, reject) => {
            const chunks: Uint8Array[] = [];

            let cmd = createCommand(inputStream, { inputFormat: options.inputFormat });
            cmd = applyConvertOptions(cmd, options);

            cmd.on("error", err => {
                reject(new Error(`Audio conversion failed: ${err.message}`));
            })
                .on("end", () => {
                    resolve(Buffer.concat(chunks));
                })
                .pipe()
                .on("data", (chunk: Uint8Array) => {
                    chunks.push(chunk);
                });
        });
    };

    // Convert audio stream to stream (most commonly used for real-time processing)
    const convertStreamToStream = (inputStream: Readable, options: FfmpegConvertOptions): Readable => {
        const outputStream = new PassThrough();

        let cmd = createCommand(inputStream, { inputFormat: options.inputFormat });
        cmd = applyConvertOptions(cmd, options);

        console.log(`[FfmpegService] Converting stream: ${options.inputFormat || "auto"} -> ${options.outputFormat} ` + `(${options.sampleRate || "?"}Hz, ${options.channels || "?"}ch, codec: ${options.codec})`);

        cmd.on("error", err => {
            console.error(`[FfmpegService] Stream conversion error: ${err.message}`);
            outputStream.destroy(err);
        })
            .on("end", () => {
                console.log("[FfmpegService] Stream conversion completed");
            })
            .pipe(outputStream, { end: true });

        return outputStream;
    };

    return {
        convertAudio,
        convertStreamToStream,
    };
};
