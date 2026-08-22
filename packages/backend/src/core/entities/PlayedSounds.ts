//Where a sound play originated. Canonical list; the DB enum must match (asserted in the adapter).
export const playedSoundSources = ["Command", "Thread", "VoiceEvent"] as const;
export type PlayedSoundSource = (typeof playedSoundSources)[number];

export type PlayedSound = {
    readonly id: number;
    readonly userId: string;
    readonly soundId: number;
    readonly source: PlayedSoundSource;
    readonly playedAt: Date;
};

export type CreatePlayedSoundData = Omit<PlayedSound, "id" | "playedAt">;
