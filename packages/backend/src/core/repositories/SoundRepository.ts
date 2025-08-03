import type { Sound } from "@core/entities/Sound";

export type SoundRepository = {
    readonly addSound: (audio: Sound) => Promise<Sound>;
    readonly getSoundByName: (name: string) => Promise<Sound | null>;
    readonly deleteSound: (name: string) => Promise<void>;
    readonly getAllSounds: () => Promise<Sound[]>;
};
