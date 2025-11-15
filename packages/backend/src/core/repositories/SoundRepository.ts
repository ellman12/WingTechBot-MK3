import type { Sound } from "@core/entities/Sound.js";

export type SoundRepository = {
    readonly addSound: (audio: Omit<Sound, "id">) => Promise<Sound>;
    readonly getSoundByName: (name: string) => Promise<Sound | null>;
    readonly deleteSound: (name: string) => Promise<void>;
    readonly getAllSounds: () => Promise<Sound[]>;
    readonly getAllSoundsWithTagName: (tagName: string) => Promise<Sound[]>;
    readonly tryGetSoundsWithinDistance: (needle: string) => Promise<(Sound & { distance: number })[]>;
};
