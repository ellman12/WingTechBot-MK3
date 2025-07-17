import type { AudioProcessingService } from "@core/services/AudioProcessingService";
import { type AudioResource } from "@discordjs/voice";
import type { FfmpegService } from "@infrastructure/ffmpeg/FfmpegService";
import { Readable } from "stream";

export type ExtendedAudioResource = AudioResource;

export type FfmpegAudioServiceDeps = {
    ffmpeg: FfmpegService;
};

export type FFmpegOptions = {
    sampleRate?: number;
    channels?: number;
    bitrate?: string;
    format?: string;
    codec?: string;
};

export const createFfmpegAudioProcessingService = ({ ffmpeg }: FfmpegAudioServiceDeps): AudioProcessingService => {
    return {
        deepProcessAudio: async (audio: Uint8Array): Promise<Uint8Array> => {
            const normalizedAudio = await ffmpeg.normalizeAudio(audio, {});

            console.log("Audio normalized successfully");

            return ffmpeg.convertAudio(normalizedAudio, {
                inputFormat: "wav",
                outputFormat: "opus",
                codec: "libopus",
                sampleRate: 48000,
                channels: 2,
                bitrate: "128k",
            });
        },
        processAudioStream: (audioStream: Readable): Readable => {
            const normalizedStream = ffmpeg.normalizeAudioStreamRealtime(audioStream);

            return ffmpeg.convertStreamToStream(normalizedStream, {
                inputFormat: "wav",
                outputFormat: "opus",
                codec: "libopus",
                sampleRate: 48000,
                channels: 2,
                bitrate: "128k",
            });
        },
    };
};
