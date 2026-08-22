import type { VoiceEventSound, VoiceEventSoundType } from "@core/entities/VoiceEventSound.js";

export type GetVoiceEventSoundsFilters = {
    readonly userId?: string;
    readonly soundId?: number;
    readonly type?: VoiceEventSoundType;
};

//Stores sounds automatically played when certain voice events happen.
export type VoiceEventSoundsRepository = {
    readonly addVoiceEventSound: (userId: string, soundId: number, type: VoiceEventSoundType) => Promise<VoiceEventSound>;
    readonly deleteVoiceEventSound: (userId: string, soundId: number, type: VoiceEventSoundType) => Promise<VoiceEventSound | null>;
    readonly getVoiceEventSounds: (filters: GetVoiceEventSoundsFilters) => Promise<(VoiceEventSound & { username: string })[]>;
};
