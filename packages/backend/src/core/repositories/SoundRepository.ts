import type { Sound } from "@core/entities/Sound";

export type SoundRepository = {
    addSound: (audio: Sound) => Promise<Sound>;
    getSoundByName: (name: string) => Promise<Sound | null>;
    deleteSound: (name: string) => Promise<void>;
    getAllSounds: () => Promise<Sound[]>;
};
