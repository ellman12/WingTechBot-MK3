import type { RegisterEventHandler } from "@application/discord/EventRegistrar.js";
import type { Config } from "@core/config/Config.js";
import type { VoiceService } from "@core/ports/services/VoiceService.js";
import { Events, type VoiceChannel, type VoiceState } from "discord.js";

export type VoiceAutoJoin = {
    readonly voiceStateUpdate: (oldState: VoiceState, newState: VoiceState) => Promise<void>;
};

export type VoiceAutoJoinDeps = {
    readonly config: Config;
    readonly voiceService: VoiceService;
};

//Joins the default voice channel when someone shows up there, and leaves when it empties out.
//If the bot is dragged out of the channel it stays out until the channel is empty again.
export const createVoiceAutoJoin = ({ config, voiceService }: VoiceAutoJoinDeps): VoiceAutoJoin => {
    const kickedStateByGuild = new Map<string, boolean>();

    const voiceStateUpdate = async (oldState: VoiceState, newState: VoiceState): Promise<void> => {
        const guild = newState.guild;
        const guildId = guild.id;
        const isConnected = voiceService.isConnected(guildId);
        const defaultVcId = config.discord.defaultVoiceChannelId;

        if (!defaultVcId) {
            console.warn("[VoiceAutoJoin] DEFAULT_VOICE_CHANNEL_ID not configured, skipping voice state update");
            return;
        }

        const connectedChannel = (await guild.channels.fetch(defaultVcId)) as VoiceChannel | null;

        if (!connectedChannel) {
            console.error(`[VoiceAutoJoin] Failed to fetch voice channel with ID: ${defaultVcId}`);
            return;
        }

        if (!connectedChannel.members) {
            console.error(`[VoiceAutoJoin] Voice channel ${defaultVcId} has no members collection`);
            return;
        }

        const botId = config.discord.clientId;
        const connectedMembers = connectedChannel.members.filter(m => m.id !== botId);

        if (oldState.member?.id === botId && oldState.channel?.id === defaultVcId && newState.channel?.id !== defaultVcId) {
            kickedStateByGuild.set(guildId, true);
            console.log(`[VoiceAutoJoin] Bot was removed from voice channel ${defaultVcId}, auto-join disabled until channel is empty`);
        }

        const wasKicked = kickedStateByGuild.get(guildId) ?? false;
        const someoneJoined = oldState.channelId !== newState.channelId && newState.channelId === defaultVcId && newState.member?.id !== botId;
        if (!isConnected && !wasKicked && someoneJoined) {
            await voiceService.connect(guildId, defaultVcId);
        }

        if (connectedMembers.size === 0) {
            if (isConnected) await voiceService.disconnect(guildId);
            if (wasKicked) {
                kickedStateByGuild.delete(guildId);
                console.log(`[VoiceAutoJoin] Voice channel ${defaultVcId} is empty, kicked state reset`);
            }
        }
    };

    return {
        voiceStateUpdate,
    };
};

export const registerVoiceAutoJoinEvents = (voiceAutoJoin: VoiceAutoJoin, register: RegisterEventHandler): void => {
    register(Events.VoiceStateUpdate, voiceAutoJoin.voiceStateUpdate);
};
