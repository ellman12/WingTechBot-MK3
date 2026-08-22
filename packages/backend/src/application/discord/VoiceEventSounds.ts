import type { RegisterEventHandler } from "@application/discord/EventRegistrar.js";
import type { VoiceEventSoundsService } from "@core/services/VoiceEventSoundsService.js";
import { getEventType } from "@core/services/VoiceEventSoundsService.js";
import { Events, type VoiceChannel, type VoiceState } from "discord.js";

export type VoiceEventSounds = {
    readonly voiceStateUpdate: (oldState: VoiceState, newState: VoiceState) => Promise<void>;
};

export type VoiceEventSoundsDeps = {
    readonly voiceEventSoundsService: VoiceEventSoundsService;
};

export const createVoiceEventSounds = ({ voiceEventSoundsService }: VoiceEventSoundsDeps): VoiceEventSounds => {
    const voiceStateUpdate = async (oldState: VoiceState, newState: VoiceState): Promise<void> => {
        const type = getEventType(oldState.channelId, newState.channelId);
        if (!type) {
            return;
        }

        const guild = newState.guild;
        const userChannelId = type === "UserJoin" ? newState.channelId : oldState.channelId;

        await voiceEventSoundsService.handleVoiceEvent({
            serverId: guild.id,
            userId: newState.member!.id,
            type,
            userChannelId,
            getChannelMemberIds: async channelId => {
                const channel = (await guild.channels.fetch(channelId)) as VoiceChannel | null;
                return channel ? [...channel.members.keys()] : [];
            },
        });
    };

    return {
        voiceStateUpdate,
    };
};

export const registerVoiceEventSoundsEvents = (voiceEventSounds: VoiceEventSounds, register: RegisterEventHandler): void => {
    register(Events.VoiceStateUpdate, voiceEventSounds.voiceStateUpdate);
};
