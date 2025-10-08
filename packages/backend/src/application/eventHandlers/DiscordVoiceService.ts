import type { VoiceService } from "@core/services/VoiceService.js";
import type { DiscordBot } from "@infrastructure/discord/DiscordBot.js";
import { VoiceChannel as DiscordVoiceChannel, Events, VoiceState } from "discord.js";

export const registerVoiceServiceEventHandlers = (voiceService: VoiceService, registerEventHandler: DiscordBot["registerEventHandler"]): void => {
    async function voiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
        const guild = newState.guild;
        const guildId = guild.id;
        const isConnected = voiceService.isConnected(guildId);
        const defaultVcId = process.env.DEFAULT_VOICE_CHANNEL_ID!;
        const connectedChannel = (await guild.channels.fetch(defaultVcId)) as DiscordVoiceChannel;
        const connectedMembers = connectedChannel.members.filter(m => m.id !== process.env.DISCORD_CLIENT_ID);

        //Join default VC if not in channel already.
        if (!isConnected && newState.member?.id !== process.env.DISCORD_CLIENT_ID && newState.channel?.id === defaultVcId) {
            await voiceService.connect(defaultVcId, guildId);
        }

        //Leave if no one left in VC.
        if (isConnected && connectedMembers.size === 0) {
            await voiceService.disconnect(guildId);
        }
    }

    registerEventHandler(Events.VoiceStateUpdate, voiceStateUpdate);
};
