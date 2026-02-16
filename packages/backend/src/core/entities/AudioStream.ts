import { Readable } from "stream";

import type { AudioFormatInfo } from "./AudioFormatInfo.js";

// Core types for audio stream metadata tracking.
// Audio flows through the pipeline with format metadata detected by ffprobe,
// processed by FFmpeg to standardized PCM, and cached with metadata for reuse.

// Audio stream with optional format metadata from ffprobe.
// Format info enables explicit FFmpeg format specification to avoid auto-detection errors.
export type AudioStreamWithMetadata = {
    readonly stream: Readable;
    readonly formatInfo?: AudioFormatInfo;
};

// Prefer this over creating the object directly.
export const createAudioStreamWithFormat = (stream: Readable, formatInfo: AudioFormatInfo): AudioStreamWithMetadata => {
    return {
        stream,
        formatInfo,
    };
};

export const extractFormatInfo = (audio: AudioStreamWithMetadata): AudioFormatInfo | undefined => {
    return audio.formatInfo;
};
