import type { Readable } from "stream";

//Storage for soundboard audio. Keys are the storage-relative paths recorded on Sound.path.
export type SoundFileStore = {
    readonly read: (soundPath: string) => Readable;
    readonly write: (soundPath: string, audio: Uint8Array) => Promise<void>;
    readonly delete: (soundPath: string) => Promise<void>;
};
