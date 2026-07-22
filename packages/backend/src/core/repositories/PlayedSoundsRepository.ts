import type { CreatePlayedSoundData, PlayedSound } from "@core/entities/PlayedSounds.js";

export type SoundPlayCount = {
    readonly id: number;
    readonly name: string;
    readonly playCount: number;
};

export type PlayedSoundsRepository = {
    addPlayedSound(data: CreatePlayedSoundData): Promise<PlayedSound>;

    getSoundPlayCount(soundId: number, userId?: string, year?: number): Promise<number>;
    getSoundPlayCounts(limit?: number, userId?: string, year?: number): Promise<SoundPlayCount[]>;
};
