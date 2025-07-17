import { Readable } from "stream";

export type AudioProcessingService = {
    // Processes audio data fully, normalizing and converting to Opus
    deepProcessAudio: (audio: Uint8Array) => Promise<Uint8Array>;
    // Processes audio data in near real-time, lightly normalizing and converting to Opus
    processAudioStream: (audioStream: Readable) => Readable;
};
