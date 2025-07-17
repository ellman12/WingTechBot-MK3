import type { AudioProcessingService } from "@core/services/AudioProcessingService";
import type { FfmpegService } from "@infrastructure/ffmpeg/FfmpegService";
import { PassThrough, Readable } from "stream";

export type FfmpegAudioServiceDeps = {
    readonly ffmpeg: FfmpegService;
};

export const createFfmpegAudioProcessingService = ({ ffmpeg }: FfmpegAudioServiceDeps): AudioProcessingService => {
    // Helper function to create buffered stream for FFmpeg output
    const createBufferedProcessingStream = (sourceStream: Readable, processType: string): Readable => {
        console.log(`[FfmpegAudioProcessingService] Creating buffered processing stream for: ${processType}`);

        const bufferedStream = new PassThrough({
            highWaterMark: 256 * 1024, // Increased to 256KB buffer for processed audio
            objectMode: false,
        });

        // Monitor processing stream health
        let bytesProcessed = 0;
        let _lastDataTime = Date.now();

        sourceStream.on("data", chunk => {
            bytesProcessed += chunk.length;
            _lastDataTime = Date.now();
            console.log(`[FfmpegAudioProcessingService] Processed stream data: ${chunk.length} bytes, total: ${bytesProcessed}`);
        });

        sourceStream.on("end", () => {
            console.log(`[FfmpegAudioProcessingService] Processing stream ended for: ${processType}, total bytes: ${bytesProcessed}`);
        });

        sourceStream.on("error", error => {
            console.error(`[FfmpegAudioProcessingService] Processing stream error for ${processType}:`, error);
            bufferedStream.destroy(error);
        });

        // Pipe with error handling
        sourceStream.pipe(bufferedStream, { end: true });

        return bufferedStream;
    };

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
            console.log(`[FfmpegAudioProcessingService] Processing audio stream with real-time normalization`);

            // Use real-time normalization + Opus encoding in a single pass for optimal streaming
            const processedStream = ffmpeg.convertStreamToStream(audioStream, {
                // Don't specify inputFormat to let FFmpeg auto-detect
                outputFormat: "opus",
                codec: "libopus",
                sampleRate: 48000,
                channels: 2,
                bitrate: "128k",
                // Add real-time loudness normalization - this will be processed by createConvertArgs
                extraArgs: ["-filter:a", "loudnorm=I=-16:TP=-1.5:LRA=11:linear=true"],
            });

            // Return buffered version of the processed stream
            return createBufferedProcessingStream(processedStream, "ffmpeg-normalized-opus");
        },
    };
};
