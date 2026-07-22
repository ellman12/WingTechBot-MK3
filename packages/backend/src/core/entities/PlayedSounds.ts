import type { PlayedSoundSource } from "@db/types.js";

export type PlayedSound = {
    readonly id: number;
    readonly userId: string;
    readonly soundId: number;
    readonly source: PlayedSoundSource;
    readonly playedAt: Date;
};

export type CreatePlayedSoundData = Omit<PlayedSound, "id" | "playedAt">;
