import type { VoiceEventSoundsRepository } from "@adapters/repositories/VoiceEventSoundsRepository.js";
import type { Config } from "@core/config/Config.js";
import type { VoiceService } from "@core/services/VoiceService.js";
import { randomArrayItem } from "@core/utils/probabilityUtils.js";
import type { VoiceEventSoundType } from "@db/types.js";
import { VoiceState } from "discord.js";

export type VoiceEventSoundsService = {
    voiceStateUpdate: (oldState: VoiceState, newState: VoiceState) => Promise<void>;
};

export type VoiceEventSoundsServiceDeps = {
    readonly config: Config;
    readonly voiceEventSoundsRepository: VoiceEventSoundsRepository;
    readonly voiceService: VoiceService;
};

export const createVoiceEventSoundsService = ({ config, voiceEventSoundsRepository, voiceService }: VoiceEventSoundsServiceDeps): VoiceEventSoundsService => {
    function getEventType(oldState: VoiceState, newState: VoiceState): VoiceEventSoundType | "" {
        if (oldState.channelId === null && newState.channelId !== null) return "UserJoin";
        if (oldState.channelId !== null && newState.channelId === null) return "UserLeave";
        return "";
    }

    async function voiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
        const type = getEventType(oldState, newState);
        if (!type) {
            return;
        }

        const guild = newState.guild;
        const userId = newState.member!.id;
        const availableSounds = await voiceEventSoundsRepository.getVoiceEventSounds({ userId, type });
        const sound = randomArrayItem(availableSounds);

        if (!sound) {
            return;
        }

        if (!voiceService.isConnected(guild.id)) {
            await voiceService.connect(guild, config.discord.defaultVoiceChannelId);
        }

        await voiceService.playAudio(guild.id, sound.soundName!);
    }

    return {
        voiceStateUpdate,
    };
};
