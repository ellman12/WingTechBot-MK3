import type { Client, ClientEvents } from "discord.js";
import { Events } from "discord.js";

/**
 * Extracts the channel ID from Discord event arguments.
 * Returns null if the channel ID cannot be determined.
 */
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

/**
 * Wraps a Discord client to intercept and filter events based on allowed channels.
 * This intercepts at the client level, so all event registrations are filtered.
 *
 * @param client - The Discord client to wrap
 * @param allowedChannels - Set of channel IDs that should be processed
 * @returns A wrapped client that filters events
 */
export function wrapClientWithEventInterceptor(client: Client, allowedChannels: Set<string>): Client {
    const originalOn = client.on.bind(client);
    const originalOnce = client.once.bind(client);

    client.on = function <K extends keyof ClientEvents>(event: K, listener: (...args: ClientEvents[K]) => void) {
        const filteredListener = async (...args: ClientEvents[K]): Promise<void> => {
            const channelId = extractChannelId(event, args);

            if (channelId !== null && !allowedChannels.has(channelId)) {
                return;
            }

            // Allow through if channelId couldn't be determined (safer than blocking)
            return listener(...args);
        };

        // Type assertion needed because filteredListener is async but listener might not be
        return originalOn(event, filteredListener as (...args: ClientEvents[K]) => void);
    };

    client.once = function <K extends keyof ClientEvents>(event: K, listener: (...args: ClientEvents[K]) => void) {
        const filteredListener = async (...args: ClientEvents[K]): Promise<void> => {
            const channelId = extractChannelId(event, args);

            if (channelId !== null && !allowedChannels.has(channelId)) {
                return;
            }

            return listener(...args);
        };

        return originalOnce(event, filteredListener as (...args: ClientEvents[K]) => void);
    };

    return client;
}
