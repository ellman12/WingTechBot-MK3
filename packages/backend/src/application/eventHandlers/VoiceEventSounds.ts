import type { VoiceEventSoundsService } from "@core/services/VoiceEventSoundsService.js";
import type { DiscordBot } from "@infrastructure/discord/DiscordBot.js";
import { Events } from "discord.js";

export const registerVoiceEventSoundsEventHandlers = (voiceEventSoundsService: VoiceEventSoundsService, registerEventHandler: DiscordBot["registerEventHandler"]): void => {
    registerEventHandler(Events.VoiceStateUpdate, voiceEventSoundsService.voiceStateUpdate);
};
