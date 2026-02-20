import type { AudioStreamWithMetadata } from "@core/entities/AudioStream.js";
import { extractFormatInfo } from "@core/entities/AudioStream.js";
import type { AudioProcessingService } from "@core/services/AudioProcessingService.js";
import type { FfmpegService } from "@infrastructure/ffmpeg/FfmpegService.js";
import { PassThrough, Readable } from "stream";

export type FfmpegAudioServiceDeps = {
    readonly ffmpeg: FfmpegService;
};

// Formats that FFmpeg accepts as demuxer names
const DEMUXER_FORMATS = new Set(["mp3", "ogg", "wav", "flac", "aac", "webm", "mp4", "m4a", "s16le", "f32le"]);

const resolveInputFormat = (format?: string, container?: string, codec?: string): string | undefined => {
    if (!format) return undefined;

    // matroska is not a valid demuxer for webm/opus content
    if (format === "matroska" && (container?.includes("webm") || codec === "opus")) {
        return "webm";
    }

    if (DEMUXER_FORMATS.has(format)) {
        return format;
    }

    return undefined;
};

export const createFfmpegAudioProcessingService = ({ ffmpeg }: FfmpegAudioServiceDeps): AudioProcessingService => {
    return {
        deepProcessAudio: async (audio: Uint8Array, format?: string, container?: string): Promise<Uint8Array> => {
            const inputFormat = resolveInputFormat(format, container);
            console.log(`[FfmpegAudioProcessingService] deepProcessAudio: format=${inputFormat || "auto-detect"}`);

            const pcmAudio = await ffmpeg.convertAudio(audio, {
                inputFormat,
                outputFormat: "s16le",
                codec: "pcm_s16le",
                sampleRate: 48000,
                channels: 2,
                extraArgs: ["-filter:a", "loudnorm=I=-24:TP=-1.5:LRA=11:linear=true"],
            });

            return pcmAudio;
        },
        processAudioStream: (audioWithMetadata: AudioStreamWithMetadata): Readable => {
            const { stream: audioStream } = audioWithMetadata;
            const formatInfo = extractFormatInfo(audioWithMetadata);
            const inputFormat = resolveInputFormat(formatInfo?.format, formatInfo?.container, formatInfo?.codec);

            console.log(`[FfmpegAudioProcessingService] processAudioStream: format=${inputFormat || "auto-detect"}`);

            const processedStream = ffmpeg.convertStreamToStream(audioStream, {
                inputFormat,
                outputFormat: "s16le",
                codec: "pcm_s16le",
                sampleRate: 48000,
                channels: 2,
                extraArgs: ["-filter:a", "loudnorm=I=-24:TP=-1.5:LRA=11:linear=true"],
            });

            const bufferedStream = new PassThrough({ highWaterMark: 64 * 1024 });
            processedStream.pipe(bufferedStream, { end: true });

            processedStream.on("error", error => {
                console.error(`[FfmpegAudioProcessingService] Processing stream error:`, error);
                bufferedStream.destroy(error);
            });

            return bufferedStream;
        },
    };
};
