import type { VoiceEventSoundType } from "@db/types.js";

export type VoiceEventSound = {
    readonly userId: string;
    readonly soundId: number;
    readonly soundName: string;
    readonly type: VoiceEventSoundType;
};
