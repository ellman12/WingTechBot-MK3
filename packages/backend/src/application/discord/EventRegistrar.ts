import type { ClientEvents } from "discord.js";

//Registers a handler for a Discord client event. Provided by infrastructure/discord/DiscordBot; consumed by application/discord features.
export type RegisterEventHandler = <K extends keyof ClientEvents>(event: K, handler: (...args: ClientEvents[K]) => void | Promise<void>) => void;

//Optional predicate applied before every registered handler (used by tests to scope a bot to specific channels).
export type EventFilter = <K extends keyof ClientEvents>(event: K, args: ClientEvents[K]) => boolean;
