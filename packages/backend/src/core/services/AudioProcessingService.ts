import { Readable } from "stream";

export type AudioProcessingService = {
    // Processes audio data fully, normalizing and converting to Opus
    readonly deepProcessAudio: (audio: Uint8Array) => Promise<Uint8Array>;
    // Processes audio data in near real-time, lightly normalizing and converting to Opus
    readonly processAudioStream: (audioStream: Readable) => Readable;
};
