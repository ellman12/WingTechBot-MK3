import type { SoundboardThreadService } from "@core/services/SoundboardThreadService.js";
import type { DiscordBot } from "@infrastructure/discord/DiscordBot.js";
import { Events } from "discord.js";

export const registerSoundboardThreadEventHandlers = (soundboardThreadService: SoundboardThreadService, registerEventHandler: DiscordBot["registerEventHandler"]): void => {
    registerEventHandler(Events.MessageCreate, soundboardThreadService.handleMessageCreated);
};
