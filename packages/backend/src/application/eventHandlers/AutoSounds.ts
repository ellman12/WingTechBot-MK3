import type { AutoSoundsService } from "@core/services/AutoSoundsService";
import type { DiscordBot } from "@infrastructure/discord/DiscordBot";
import { Events } from "discord.js";

export const registerAutoSoundsEvents = (autoSoundsService: AutoSoundsService, registerEventHandler: DiscordBot["registerEventHandler"]): void => {
    registerEventHandler(Events.VoiceStateUpdate, autoSoundsService.voiceStateUpdate);
};
