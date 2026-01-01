import type { AudioStreamWithMetadata } from "@core/entities/AudioStream.js";
import { extractFormatInfo } from "@core/entities/AudioStream.js";
import type { AudioProcessingService } from "@core/services/AudioProcessingService.js";
import type { FfmpegService } from "@infrastructure/ffmpeg/FfmpegService.js";
import { PassThrough, Readable } from "stream";

export type FfmpegAudioServiceDeps = {
    readonly ffmpeg: FfmpegService;
};

export const createFfmpegAudioProcessingService = ({ ffmpeg }: FfmpegAudioServiceDeps): AudioProcessingService => {
    const createBufferedProcessingStream = (sourceStream: Readable, processType: string): Readable => {
        console.log(`[FfmpegAudioProcessingService] Creating buffered processing stream for: ${processType}`);

        const bufferedStream = new PassThrough({
            highWaterMark: 256 * 1024,
            objectMode: false,
        });

        let bytesProcessed = 0;
        let _lastDataTime = Date.now();

        sourceStream.on("data", chunk => {
            bytesProcessed += chunk.length;
            _lastDataTime = Date.now();
        });

        sourceStream.on("end", () => {
            console.log(`[FfmpegAudioProcessingService] Processing stream ended for: ${processType}, total bytes: ${bytesProcessed}`);
        });

        sourceStream.on("error", error => {
            console.error(`[FfmpegAudioProcessingService] Processing stream error for ${processType}:`, error);
            bufferedStream.destroy(error);
        });

        sourceStream.pipe(bufferedStream, { end: true });

        return bufferedStream;
    };

    return {
        deepProcessAudio: async (audio: Uint8Array, format?: string, container?: string): Promise<Uint8Array> => {
            console.log(`[FfmpegAudioProcessingService] Step 1: Converting audio to PCM with normalization (format: ${format || "auto-detect"}, container: ${container || "auto-detect"})`);

            let inputFormat = format || undefined;

            if (inputFormat === "matroska" && container?.includes("webm")) {
                console.log(`[FfmpegAudioProcessingService] Detected matroska/webm, using 'webm' format instead of 'matroska'`);
                inputFormat = "webm";
            }

            if (inputFormat) {
                console.log(`[FfmpegAudioProcessingService] Using explicit input format: ${inputFormat}`);
            } else {
                console.log(`[FfmpegAudioProcessingService] No format provided, FFmpeg will auto-detect (may cause errors)`);
            }

            // Convert directly to PCM s16le with normalization in a single pass
            const pcmAudio = await ffmpeg.convertAudio(audio, {
                inputFormat,
                outputFormat: "s16le",
                codec: "pcm_s16le",
                sampleRate: 48000,
                channels: 2,
                extraArgs: ["-filter:a", "loudnorm=I=-16:TP=-1.5:LRA=11:linear=true"],
            });

            console.log("[FfmpegAudioProcessingService] Step 2: Audio converted and normalized to PCM");

            return pcmAudio;
        },
        processAudioStream: (audioWithMetadata: AudioStreamWithMetadata): Readable => {
            const { stream: audioStream } = audioWithMetadata;

            const formatInfo = extractFormatInfo(audioWithMetadata);
            let inputFormat = formatInfo?.format || undefined;

            if (inputFormat === "matroska" && (formatInfo?.container?.includes("webm") || formatInfo?.codec === "opus")) {
                console.log(`[FfmpegAudioProcessingService] Detected matroska/webm with opus codec, using 'webm' format instead of 'matroska'`);
                inputFormat = "webm";
            }

            console.log(`[FfmpegAudioProcessingService] Processing audio stream with real-time normalization (format: ${inputFormat || "auto-detect"}, container: ${formatInfo?.container || "auto-detect"})`);

            if (inputFormat) {
                console.log(`[FfmpegAudioProcessingService] Using explicit input format: ${inputFormat}`);
            } else {
                console.warn(`[FfmpegAudioProcessingService] No format provided, FFmpeg will auto-detect (may cause errors)`);
            }

            const processedStream = ffmpeg.convertStreamToStream(audioStream, {
                inputFormat,
                outputFormat: "s16le",
                codec: "pcm_s16le",
                sampleRate: 48000,
                channels: 2,
                extraArgs: ["-filter:a", "loudnorm=I=-16:TP=-1.5:LRA=11:linear=true"],
            });

            return createBufferedProcessingStream(processedStream, "ffmpeg-normalized-pcm");
        },
    };
};
