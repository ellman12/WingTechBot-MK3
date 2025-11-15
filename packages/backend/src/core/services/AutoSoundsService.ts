import type { AutoSoundsRepository } from "@adapters/repositories/AutoSoundsRepository.js";
import type { VoiceService } from "@core/services/VoiceService.js";
import { randomArrayItem } from "@core/utils/probabilityUtils.js";
import type { AutoSoundType } from "@db/types";
import { VoiceState } from "discord.js";

export type AutoSoundsService = {
    voiceStateUpdate: (oldState: VoiceState, newState: VoiceState) => Promise<void>;
};

export type AutoSoundsServiceDeps = {
    autoSoundsRepository: AutoSoundsRepository;
    voiceService: VoiceService;
};

export const createAutoSoundsService = ({ autoSoundsRepository, voiceService }: AutoSoundsServiceDeps): AutoSoundsService => {
    function getEventType(oldState: VoiceState, newState: VoiceState): AutoSoundType | "" {
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
        const availableSounds = await autoSoundsRepository.getAutoSounds({ userId, type });
        const sound = randomArrayItem(availableSounds);

        if (!sound) {
            return;
        }

        if (!voiceService.isConnected(guild.id)) {
            await voiceService.connect(guild, process.env.DEFAULT_VOICE_CHANNEL_ID!);
        }

        await voiceService.playAudio(guild.id, sound.soundName!);
    }

    return {
        voiceStateUpdate,
    };
};
