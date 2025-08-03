import { Readable } from "stream";

export type PlayingSound = {
    readonly id: string;
    readonly stream: Readable;
    readonly volume: number;
    readonly abortController: AbortController;
    readonly metadata?: Record<string, unknown>;
    readonly abort: () => void;
};

export const createPlayingSound = (
    id: string,
    stream: Readable,
    volume: number = 1.0,
    metadata?: Record<string, unknown>
): PlayingSound => {
    const abortController = new AbortController();
    
    const abort = () => {
        abortController.abort();
        if (!stream.destroyed) {
            stream.destroy();
        }
    };

    // Handle stream cleanup when aborted
    abortController.signal.addEventListener('abort', () => {
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