import { Readable } from "stream";

import type { AudioFormatInfo } from "./AudioFormatInfo.js";

/**
 * Extended metadata for a playing sound.
 * Includes both application-level metadata (source, server) and
 * format metadata for debugging/monitoring.
 */
export type PlayingSoundMetadata = {
    readonly source?: string;
    readonly server?: string;
    readonly formatInfo?: AudioFormatInfo;
};

/**
 * Represents an actively playing audio stream.
 *
 * IMPORTANT: The stream at this point should already be processed PCM audio
 * (48kHz, 2ch, 16-bit). The formatInfo metadata is for debugging/logging only,
 * NOT for runtime format detection or conversion.
 */
export type PlayingSound = {
    readonly id: string;
    /** Pre-processed PCM audio stream (48kHz, 2ch, 16-bit) */
    readonly stream: Readable;
    readonly volume: number;
    readonly abortController: AbortController;
    readonly metadata?: PlayingSoundMetadata;
    readonly abort: () => void;
};

export const createPlayingSound = (id: string, stream: Readable, volume: number = 1.0, metadata?: PlayingSoundMetadata): PlayingSound => {
    const abortController = new AbortController();

    const abort = () => {
        abortController.abort();
        if (!stream.destroyed) {
            stream.destroy();
        }
    };

    abortController.signal.addEventListener("abort", () => {
        if (!stream.destroyed) {
            stream.destroy();
        }
    });

    return {
        id,
        stream,
        volume: Math.max(0, Math.min(1, volume)),
        abortController,
        metadata,
        abort,
    };
};
