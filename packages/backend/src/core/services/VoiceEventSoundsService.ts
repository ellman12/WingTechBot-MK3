import type { VoiceEventSoundsRepository } from "@adapters/repositories/VoiceEventSoundsRepository.js";
import type { VoiceService } from "@core/services/VoiceService.js";
import { randomArrayItem } from "@core/utils/probabilityUtils.js";
import type { VoiceEventSoundType } from "@db/types";
import { getConfig } from "@infrastructure/config/Config.js";
import { VoiceState } from "discord.js";

export type VoiceEventSoundsService = {
    voiceStateUpdate: (oldState: VoiceState, newState: VoiceState) => Promise<void>;
};

export type VoiceEventSoundsServiceDeps = {
    voiceEventSoundsRepository: VoiceEventSoundsRepository;
    voiceService: VoiceService;
};

export const createVoiceEventSoundsService = ({ voiceEventSoundsRepository, voiceService }: VoiceEventSoundsServiceDeps): VoiceEventSoundsService => {
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
            await voiceService.connect(guild, getConfig().discord.defaultVoiceChannelId);
        }

        await voiceService.playAudio(guild.id, sound.soundName!);
    }

    return {
        voiceStateUpdate,
    };
};
