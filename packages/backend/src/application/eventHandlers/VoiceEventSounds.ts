import type { VoiceEventSoundsService } from "@core/services/VoiceEventSoundsService";
import type { DiscordBot } from "@infrastructure/discord/DiscordBot";
import { Events } from "discord.js";

export const registerVoiceEventSoundsEventHandlers = (voiceEventSoundsService: VoiceEventSoundsService, registerEventHandler: DiscordBot["registerEventHandler"]): void => {
    registerEventHandler(Events.VoiceStateUpdate, voiceEventSoundsService.voiceStateUpdate);
};
