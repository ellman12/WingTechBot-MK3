import type { DiscordUserSyncService } from "@core/services/DiscordUserSyncService.js";
import type { DiscordBot } from "@infrastructure/discord/DiscordBot.js";
import { Events } from "discord.js";

export const registerDiscordUserSyncEvents = (discordUserSyncService: DiscordUserSyncService, registerEventHandler: DiscordBot["registerEventHandler"]): void => {
    registerEventHandler(Events.GuildMemberAdd, discordUserSyncService.guildMemberAdd);
    registerEventHandler(Events.GuildMemberUpdate, discordUserSyncService.guildMemberUpdate);
    registerEventHandler(Events.GuildMemberRemove, discordUserSyncService.guildMemberRemove);
};
