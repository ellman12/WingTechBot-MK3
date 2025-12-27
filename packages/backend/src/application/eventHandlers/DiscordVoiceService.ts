import type { VoiceService } from "@core/services/VoiceService.js";
import type { DiscordBot } from "@infrastructure/discord/DiscordBot.js";
import { Events, VoiceChannel, VoiceState } from "discord.js";

export const registerVoiceServiceEventHandlers = (voiceService: VoiceService, registerEventHandler: DiscordBot["registerEventHandler"]): void => {
    async function voiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
        const guild = newState.guild;
        const guildId = guild.id;
        const isConnected = voiceService.isConnected(guildId);
        const defaultVcId = process.env.DEFAULT_VOICE_CHANNEL_ID;

        // Validate DEFAULT_VOICE_CHANNEL_ID is configured
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

        const connectedMembers = connectedChannel.members.filter(m => m.id !== process.env.DISCORD_CLIENT_ID);

        //Join default VC if not in channel already.
        if (!isConnected && newState.member?.id !== process.env.DISCORD_CLIENT_ID && newState.channel?.id === defaultVcId) {
            await voiceService.connect(guild, defaultVcId);
        }

        //Leave if no one left in VC.
        if (isConnected && connectedMembers.size === 0) {
            await voiceService.disconnect(guildId);
        }
    }

    registerEventHandler(Events.VoiceStateUpdate, voiceStateUpdate);
};
