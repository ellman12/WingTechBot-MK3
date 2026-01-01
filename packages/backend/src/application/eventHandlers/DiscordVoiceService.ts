import type { VoiceService } from "@core/services/VoiceService.js";
import { getConfig } from "@infrastructure/config/Config";
import type { DiscordBot } from "@infrastructure/discord/DiscordBot.js";
import { Events, VoiceChannel, VoiceState } from "discord.js";

export const registerVoiceServiceEventHandlers = (voiceService: VoiceService, registerEventHandler: DiscordBot["registerEventHandler"]): void => {
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

        //Join default VC if not in channel already.
        if (!isConnected && newState.member?.id !== botId && newState.channel?.id === defaultVcId) {
            await voiceService.connect(guild, defaultVcId);
        }

        //Leave if no one left in VC.
        if (isConnected && connectedMembers.size === 0) {
            await voiceService.disconnect(guildId);
        }
    }

    registerEventHandler(Events.VoiceStateUpdate, voiceStateUpdate);
};
