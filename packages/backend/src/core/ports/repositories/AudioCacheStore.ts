import type { AudioFormatInfo } from "@core/entities/AudioFormatInfo.js";
import type { AudioStreamWithMetadata } from "@core/entities/AudioStream.js";

export type AudioCacheEntry = {
    readonly key: string;
    readonly sizeBytes: number;
    readonly cachedAt: Date;
};

//Storage for downloaded audio. Expiry and eviction policy live in AudioCacheService.
export type AudioCacheStore = {
    readonly stat: (key: string) => Promise<AudioCacheEntry | null>;
    readonly read: (key: string) => Promise<AudioStreamWithMetadata>;
    readonly write: (key: string, audio: Uint8Array, formatInfo?: AudioFormatInfo) => Promise<void>;
    //Removes the entry and anything stored alongside it. Missing entries are ignored.
    readonly delete: (key: string) => Promise<void>;
    readonly list: () => Promise<AudioCacheEntry[]>;
};
