//Voice events that can trigger a sound. Canonical list; the DB enum must match (asserted in the adapter).
export const voiceEventSoundTypes = ["UserJoin", "UserLeave"] as const;
export type VoiceEventSoundType = (typeof voiceEventSoundTypes)[number];

export type VoiceEventSound = {
    readonly userId: string;
    readonly soundId: number;
    readonly soundName: string;
    readonly type: VoiceEventSoundType;
};
