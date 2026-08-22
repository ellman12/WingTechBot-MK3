import type { AudioStreamWithMetadata } from "@core/entities/AudioStream.js";
import { Readable } from "stream";

export type AudioProcessingService = {
    // Processes audio data fully, normalizing and converting to PCM
    readonly deepProcessAudio: (audio: Uint8Array, format?: string, container?: string) => Promise<Uint8Array>;
    // Processes audio data in near real-time, lightly normalizing and converting to PCM
    readonly processAudioStream: (audioWithMetadata: AudioStreamWithMetadata) => Readable;
};
