import { config } from "@dotenvx/dotenvx";
import { getConfig, resetConfig } from "@infrastructure/config/Config.js";
import type { DiscordBot } from "@infrastructure/discord/DiscordBot.js";
import { Client, Partials } from "discord.js";
import path from "path";

//Used with WTB MK3's integration tests. Sends messages, adds reactions, etc.
export const createTesterDiscordBot = async (): Promise<DiscordBot> => {
    resetConfig();
    config({ path: path.resolve(__dirname, ".env.test"), strict: false, override: true });
    const testerConfig = getConfig("tester");

    const client = new Client({
        intents: [],
        partials: [Partials.User, Partials.GuildMember, Partials.ThreadMember, Partials.Channel, Partials.Message, Partials.Reaction],
    });

    let isReadyState = false;

    const start = async (): Promise<void> => {
        try {
            await client.login(testerConfig.discord.token);
        } catch (error) {
            console.error("❌ Failed to start tester bot:", error);
            throw error;
        }
    };

    const stop = async (): Promise<void> => {
        try {
            await client.destroy();
            isReadyState = false;
        } catch (error) {
            console.error("❌ Error stopping tester bot:", error);
            throw error;
        }
    };

    const isReady = (): boolean => isReadyState;

    await start();

    return {
        client,
        isReady,
        start,
        stop,
        registerEventHandler: () => {},
    };
};
