import type { VoiceService } from "@core/services/VoiceService.js";
import { getConfig } from "@infrastructure/config/Config.js";
import type { DiscordBot } from "@infrastructure/discord/DiscordBot.js";
import { Events, VoiceChannel, VoiceState } from "discord.js";

export const registerVoiceServiceEventHandlers = (voiceService: VoiceService, registerEventHandler: DiscordBot["registerEventHandler"]): void => {
    const kickedStateByGuild = new Map<string, boolean>();

    async function voiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
        const guild = newState.guild;
        const guildId = guild.id;
        const isConnected = voiceService.isConnected(guildId);
        const defaultVcId = getConfig().discord.defaultVoiceChannelId;

        if (!defaultVcId) {
            console.warn("[DiscordVoiceService] DEFAULT_VOICE_CHANNEL_ID not configured, skipping voice state update");
            return;
        }

        const connectedChannel = (await guild.channels.fetch(defaultVcId)) as VoiceChannel | null;

        if (!connectedChannel) {
            console.error(`[DiscordVoiceService] Failed to fetch voice channel with ID: ${defaultVcId}`);
            return;
        }

        if (!connectedChannel.members) {
            console.error(`[DiscordVoiceService] Voice channel ${defaultVcId} has no members collection`);
            return;
        }

        const botId = getConfig().discord.clientId;
        const connectedMembers = connectedChannel.members.filter(m => m.id !== botId);

        //Detect if bot was kicked from the voice channel.
        if (oldState.member?.id === botId && oldState.channel?.id === defaultVcId && newState.channel?.id !== defaultVcId) {
            kickedStateByGuild.set(guildId, true);
            console.log(`[DiscordVoiceService] Bot was removed from voice channel ${defaultVcId}, auto-join disabled until channel is empty`);
        }

        //Join default VC if not in channel already, not in kicked state, and if someone joined the channel.
        const wasKicked = kickedStateByGuild.get(guildId) ?? false;
        const someoneJoined = oldState.channelId !== newState.channelId && newState.channelId === defaultVcId && newState.member?.id !== botId;
        if (!isConnected && !wasKicked && someoneJoined) {
            await voiceService.connect(guild, defaultVcId);
        }

        //Leave if no one left in VC and reset kicked state.
        if (connectedMembers.size === 0) {
            if (isConnected) await voiceService.disconnect(guildId);
            if (wasKicked) {
                kickedStateByGuild.delete(guildId);
                console.log(`[DiscordVoiceService] Voice channel ${defaultVcId} is empty, kicked state reset`);
            }
        }
    }

    registerEventHandler(Events.VoiceStateUpdate, voiceStateUpdate);
};
