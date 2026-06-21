import type { Config } from "@core/config/Config.js";
import type { VoiceService } from "@core/services/VoiceService.js";
import { logger } from "@core/utils/logger.js";
import type { DiscordBot } from "@infrastructure/discord/DiscordBot.js";
import { Events, VoiceChannel, VoiceState } from "discord.js";

export const registerVoiceServiceEventHandlers = (config: Config, voiceService: VoiceService, registerEventHandler: DiscordBot["registerEventHandler"]): void => {
    const kickedStateByGuild = new Map<string, boolean>();

    async function voiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
        const guild = newState.guild;
        const guildId = guild.id;
        const isConnected = voiceService.isConnected(guildId);
        const defaultVcId = config.discord.defaultVoiceChannelId;

        if (!defaultVcId) {
            logger.warn("[DiscordVoiceService] DEFAULT_VOICE_CHANNEL_ID not configured, skipping voice state update");
            return;
        }

        const connectedChannel = (await guild.channels.fetch(defaultVcId)) as VoiceChannel | null;

        if (!connectedChannel) {
            logger.error(`[DiscordVoiceService] Failed to fetch voice channel with ID: ${defaultVcId}`);
            return;
        }

        if (!connectedChannel.members) {
            logger.error(`[DiscordVoiceService] Voice channel ${defaultVcId} has no members collection`);
            return;
        }

        const botId = config.discord.clientId;
        const connectedMembers = connectedChannel.members.filter(m => m.id !== botId);

        if (oldState.member?.id === botId && oldState.channel?.id === defaultVcId && newState.channel?.id !== defaultVcId) {
            kickedStateByGuild.set(guildId, true);
            logger.debug(`[DiscordVoiceService] Bot was removed from voice channel ${defaultVcId}, auto-join disabled until channel is empty`);
        }

        const wasKicked = kickedStateByGuild.get(guildId) ?? false;
        const someoneJoined = oldState.channelId !== newState.channelId && newState.channelId === defaultVcId && newState.member?.id !== botId;
        if (!isConnected && !wasKicked && someoneJoined) {
            await voiceService.connect(guild, defaultVcId);
        }

        if (connectedMembers.size === 0) {
            if (isConnected) await voiceService.disconnect(guildId);
            if (wasKicked) {
                kickedStateByGuild.delete(guildId);
                logger.debug(`[DiscordVoiceService] Voice channel ${defaultVcId} is empty, kicked state reset`);
            }
        }
    }

    registerEventHandler(Events.VoiceStateUpdate, voiceStateUpdate);
};
