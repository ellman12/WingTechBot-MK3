import type { EventFilter } from "@infrastructure/discord/DiscordBot.js";
import type { ClientEvents } from "discord.js";
import { Events } from "discord.js";

// Extracts the channel ID from Discord event arguments.
// Returns null if the channel ID cannot be determined.
function extractChannelId<K extends keyof ClientEvents>(event: K, args: ClientEvents[K]): string | null {
    try {
        if (event === Events.MessageReactionAdd || event === Events.MessageReactionRemove || event === Events.MessageReactionRemoveEmoji) {
            const [reaction] = args as ClientEvents[typeof Events.MessageReactionAdd];
            return reaction.message.channelId || null;
        }

        if (event === Events.MessageReactionRemoveAll) {
            const [message] = args as ClientEvents[typeof Events.MessageReactionRemoveAll];
            return message.channelId || null;
        }

        if (event === Events.MessageCreate || event === Events.MessageUpdate || event === Events.MessageDelete) {
            const [message] = args as ClientEvents[typeof Events.MessageCreate];
            return message.channelId || null;
        }

        return null;
    } catch {
        // Return null on failure to allow event through rather than blocking (safer)
        return null;
    }
}

// Creates an event filter function that filters events based on allowed channels.
// Returns true if the event should be processed, false if it should be filtered out.
export function createChannelEventFilter(allowedChannels: Set<string>): EventFilter {
    return <K extends keyof ClientEvents>(event: K, args: ClientEvents[K]): boolean => {
        const channelId = extractChannelId(event, args);

        // Allow through if channelId couldn't be determined (safer than blocking)
        if (channelId === null) {
            return true;
        }

        return allowedChannels.has(channelId);
    };
}
