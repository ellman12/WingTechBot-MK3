import type { VoiceStateRepository } from "@core/repositories/VoiceStateRepository.js";
import type { Client } from "discord.js";

import { createDiscordVoiceStateRepository } from "./DiscordVoiceStateRepository.js";

export const createDiscordVoiceStateRepositoryFromClient = (client: Client): VoiceStateRepository => {
    return createDiscordVoiceStateRepository({ client });
};
