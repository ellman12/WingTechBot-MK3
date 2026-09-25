import type { Config } from "@core/config/Config.js";
import type { BannedFeaturesRepository } from "@core/ports/repositories/BannedFeaturesRepository.js";
import type { SoundRepository } from "@core/ports/repositories/SoundRepository.js";
import type { VoiceService } from "@core/ports/services/VoiceService.js";

//Which sound (if any) a piece of text refers to. The caller decides how to tell the user.
export type SoundboardResolution =
    { readonly kind: "banned" } | { readonly kind: "noMatch" } | { readonly kind: "ambiguous"; readonly candidates: string[] } | { readonly kind: "resolved"; readonly soundName: string; readonly corrected: boolean; readonly originalText: string };

//What happened to a soundboard request end to end.
export type SoundboardOutcome = Exclude<SoundboardResolution, { kind: "resolved" }> | { readonly kind: "played"; readonly soundName: string; readonly corrected: boolean; readonly originalText: string };

export type SoundboardRequest = {
    readonly serverId: string;
    readonly userId: string;
    readonly text: string;
};

export type SoundboardService = {
    //Finds the sound a user's text refers to, applying the ban check and fuzzy correction.
    readonly resolveSound: (request: Pick<SoundboardRequest, "userId" | "text">) => Promise<SoundboardResolution>;
    //Plays a resolved sound in the server's voice channel, connecting to the default channel if needed.
    readonly playSound: (serverId: string, soundName: string, userId: string) => Promise<void>;
    //resolveSound + playSound.
    readonly playSoundByText: (request: SoundboardRequest) => Promise<SoundboardOutcome>;
};

export type SoundboardServiceDeps = {
    readonly config: Config;
    readonly soundRepository: SoundRepository;
    readonly voiceService: VoiceService;
    readonly bannedFeaturesRepository: BannedFeaturesRepository;
};

export const createSoundboardService = ({ config, soundRepository, voiceService, bannedFeaturesRepository }: SoundboardServiceDeps): SoundboardService => {
    const resolveSound = async ({ userId, text }: Pick<SoundboardRequest, "userId" | "text">): Promise<SoundboardResolution> => {
        if (await bannedFeaturesRepository.isUserBanned(userId, "Soundboard")) {
            return { kind: "banned" };
        }

        const needle = text.toLowerCase();
        const foundSounds = await soundRepository.tryGetSoundsWithinDistance(needle);
        if (foundSounds.length === 0) {
            return { kind: "noMatch" };
        }

        //Since sound names are unique there can only be one with distance of 0.
        const closestSound = foundSounds.find(s => s.distance === 0);
        if (!closestSound && foundSounds.length > 1) {
            return { kind: "ambiguous", candidates: foundSounds.map(s => s.name) };
        }

        const sound = closestSound ?? foundSounds[0]!;
        return { kind: "resolved", soundName: sound.name, corrected: !closestSound, originalText: needle };
    };

    const playSound = async (serverId: string, soundName: string, userId: string): Promise<void> => {
        if (!voiceService.isConnected(serverId)) {
            await voiceService.connect(serverId, config.discord.defaultVoiceChannelId);
        }

        await voiceService.playAudio(serverId, soundName, userId, "Thread");
    };

    const playSoundByText = async ({ serverId, userId, text }: SoundboardRequest): Promise<SoundboardOutcome> => {
        const resolution = await resolveSound({ userId, text });
        if (resolution.kind !== "resolved") return resolution;

        await playSound(serverId, resolution.soundName, userId);
        return { ...resolution, kind: "played" };
    };

    return {
        resolveSound,
        playSound,
        playSoundByText,
    };
};
