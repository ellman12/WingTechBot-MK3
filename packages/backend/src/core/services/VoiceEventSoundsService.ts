import type { Config } from "@core/config/Config.js";
import type { VoiceEventSoundType } from "@core/entities/VoiceEventSound.js";
import type { VoiceEventSoundsRepository } from "@core/ports/repositories/VoiceEventSoundsRepository.js";
import type { VoiceService } from "@core/ports/services/VoiceService.js";
import { randomArrayItem } from "@core/utils/probabilityUtils.js";
import { sleep } from "@core/utils/timeUtils.js";

export type VoiceEvent = {
    readonly serverId: string;
    readonly userId: string;
    readonly type: VoiceEventSoundType;
    //The channel the user joined (UserJoin) or left (UserLeave).
    readonly userChannelId: string | null;
    //Ids of everyone currently in a channel. Used to detect "only the bot is left".
    readonly getChannelMemberIds: (channelId: string) => Promise<string[]>;
};

export type VoiceEventSoundsService = {
    readonly handleVoiceEvent: (event: VoiceEvent) => Promise<void>;
};

export type VoiceEventSoundsServiceDeps = {
    readonly config: Config;
    readonly voiceEventSoundsRepository: VoiceEventSoundsRepository;
    readonly voiceService: VoiceService;
};

//Delays in ms for each event type before the sound is played.
const soundDelays: Record<VoiceEventSoundType, number> = {
    UserJoin: 1200, //Ensures the person who joined can also hear their sound. Gives time for their connection to init.
    UserLeave: 55, //Ensures others can hear this sound after the "leave call" Discord sound plays.
};

//Joining a channel from nowhere is a UserJoin, leaving to nowhere is a UserLeave. Channel switches are neither.
export const getEventType = (oldChannelId: string | null, newChannelId: string | null): VoiceEventSoundType | null => {
    if (oldChannelId === null && newChannelId !== null) return "UserJoin";
    if (oldChannelId !== null && newChannelId === null) return "UserLeave";
    return null;
};

export const createVoiceEventSoundsService = ({ config, voiceEventSoundsRepository, voiceService }: VoiceEventSoundsServiceDeps): VoiceEventSoundsService => {
    const botId = config.discord.clientId;

    const handleVoiceEvent = async ({ serverId, userId, type, userChannelId, getChannelMemberIds }: VoiceEvent): Promise<void> => {
        //Only react to events in whichever channel the bot is in.
        const botChannelId = voiceService.getVoiceChannelId(serverId) ?? config.discord.defaultVoiceChannelId;
        if (userChannelId !== botChannelId) return;

        const memberIds = await getChannelMemberIds(botChannelId);
        if (type === "UserLeave" && memberIds.length === 1 && memberIds[0] === botId) return; //If only bot left, just leave. Prevents errors.

        const availableSounds = await voiceEventSoundsRepository.getVoiceEventSounds({ userId, type });
        const sound = randomArrayItem(availableSounds);
        if (!sound) return;

        const delay = soundDelays[type];
        if (delay) {
            await sleep(delay);
        }

        await voiceService.playAudio(serverId, sound.soundName, botId, "VoiceEvent");
    };

    return {
        handleVoiceEvent,
    };
};
