import type { Config } from "@core/config/Config.js";

/**
 * Checks if events from a channel should be processed based on the config's channel restrictions.
 *
 * @param channelId - The ID of the channel to check
 * @param config - The application config containing optional channel restrictions
 * @returns true if the channel should be processed, false otherwise
 */
export function shouldProcessChannel(channelId: string, config: Config): boolean {
    const restrictToChannelIds = config.discord.restrictToChannelIds;

    // If no restriction, process all channels
    if (!restrictToChannelIds || restrictToChannelIds.length === 0) {
        return true;
    }

    // Otherwise, only process if channel is in the allowed list
    return restrictToChannelIds.includes(channelId);
}
