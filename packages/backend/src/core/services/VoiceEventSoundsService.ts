import type { VoiceEventSoundsRepository } from "@adapters/repositories/VoiceEventSoundsRepository.js";
import type { VoiceService } from "@adapters/services/DiscordVoiceService.js";
import type { Config } from "@core/config/Config.js";
import { randomArrayItem } from "@core/utils/probabilityUtils.js";
import { sleep } from "@core/utils/timeUtils.js";
import type { VoiceEventSoundType } from "@db/types.js";
import { type VoiceChannel, VoiceState } from "discord.js";

export type VoiceEventSoundsService = {
    voiceStateUpdate: (oldState: VoiceState, newState: VoiceState) => Promise<void>;
};

export type VoiceEventSoundsServiceDeps = {
    readonly config: Config;
    readonly voiceEventSoundsRepository: VoiceEventSoundsRepository;
    readonly voiceService: VoiceService;
};

//Delays in ms for each event type before the sound is played.
const soundDelays = {
    UserJoin: 1200, //Ensures the person who joined can also hear their sound. Gives time for their connection to init.
    UserLeave: 55, //Ensures others can hear this sound after the "leave call" Discord sound plays.
};

export const createVoiceEventSoundsService = ({ config, voiceEventSoundsRepository, voiceService }: VoiceEventSoundsServiceDeps): VoiceEventSoundsService => {
    const botId = config.discord.clientId;

    function getEventType(oldState: VoiceState, newState: VoiceState): VoiceEventSoundType | "" {
        if (oldState.channelId === null && newState.channelId !== null) return "UserJoin";
        if (oldState.channelId !== null && newState.channelId === null) return "UserLeave";
        return "";
    }

    async function voiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
        const type = getEventType(oldState, newState);
        if (!type) return;

        const guild = newState.guild;
        const userId = newState.member!.id;

        const userChannelId = type === "UserJoin" ? newState.channelId : oldState.channelId;
        const botChannelId = voiceService.getVoiceChannelId(guild.id) ?? config.discord.defaultVoiceChannelId;
        if (userChannelId !== botChannelId) return;

        const members = ((await guild.channels.fetch(botChannelId)) as VoiceChannel).members;
        if (type === "UserLeave" && members.size === 1 && members.first()?.id === botId) return; //If only bot left, just leave. Prevents errors.

        const availableSounds = await voiceEventSoundsRepository.getVoiceEventSounds({ userId, type });
        const sound = randomArrayItem(availableSounds);
        if (!sound) return;

        const delay = soundDelays[type];
        if (delay) {
            await sleep(delay);
        }

        await voiceService.playAudio(guild.id, sound.soundName, botId, "VoiceEvent");
    }

    return {
        voiceStateUpdate,
    };
};
