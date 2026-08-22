import type { CreatePlayedSoundData, PlayedSound } from "@core/entities/PlayedSounds.js";

export type SoundPlayCount = {
    readonly id: number;
    readonly name: string;
    readonly playCount: number;
};

export type SoundPlayedDates = {
    readonly id: number;
    readonly name: string;
    readonly latestDate: Date;
    readonly oldestDate: Date;
};

export type PlayedSoundsRepository = {
    readonly addPlayedSound: (data: CreatePlayedSoundData) => Promise<PlayedSound>;
    readonly getSoundPlayCount: (soundId: number, userId?: string, year?: number) => Promise<number>;
    readonly getSoundPlayCounts: (limit?: number, userId?: string, year?: number) => Promise<SoundPlayCount[]>;
    readonly getSoundPlayedDates: (userId?: string, year?: number) => Promise<SoundPlayedDates[]>;
};
