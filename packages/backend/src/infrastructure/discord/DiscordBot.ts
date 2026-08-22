import type { EventFilter, RegisterEventHandler } from "@application/discord/EventRegistrar.js";
import type { Config } from "@core/config/Config.js";
import { sleep } from "@core/utils/timeUtils.js";
import { type Client, type ClientEvents, Events, type Guild, PresenceUpdateStatus, RESTEvents } from "discord.js";

import type { DiscordClientHandle } from "./DiscordClientHandle.js";

//What the application layer plugs into the bot lifecycle. See application/discord/DiscordApplication.ts.
export type DiscordApplicationBindings = {
    //Called once per client creation, before login. Register every event handler here.
    readonly registerEvents: (register: RegisterEventHandler) => void;
    //Called after login once the guild is fetched. Startup orchestration (deploy commands, sync, presence…) lives here.
    readonly onReady: (ctx: { readonly client: Client<true>; readonly guild: Guild }) => Promise<void>;
};

export type DiscordBotDeps = {
    readonly config: Config;
    readonly clientHandle: DiscordClientHandle;
    readonly application: DiscordApplicationBindings;
    readonly eventFilter?: EventFilter;
};

export type DiscordBot = {
    readonly client: Client;
    readonly isReady: () => boolean;
    readonly start: () => Promise<void>;
    readonly stop: () => Promise<void>;
    readonly registerEventHandler: RegisterEventHandler;
};

//Infrastructure: owns login/ready/shutdown of the Discord client. Knows nothing about features — those come in via `application`.
export const createDiscordBot = ({ config, clientHandle, application, eventFilter }: DiscordBotDeps): DiscordBot => {
    let isReadyState = false;

    const registerEventHandler: RegisterEventHandler = <K extends keyof ClientEvents>(event: K, handler: (...args: ClientEvents[K]) => void | Promise<void>): void => {
        if (!clientHandle.hasClient()) {
            throw new Error("Discord client is not initialized. Call start() before registering event handlers.");
        }

        if (clientHandle.isDestroyed()) {
            throw new Error("Discord client has been destroyed. Cannot register new event handlers.");
        }

        const wrappedHandler = eventFilter
            ? (...args: ClientEvents[K]): void | Promise<void> => {
                  if (!eventFilter(event, args)) {
                      return;
                  }
                  return handler(...args);
              }
            : handler;

        clientHandle.client.on(event, wrappedHandler);
    };

    const setupBaseEventHandlers = (client: Client): void => {
        client.once(Events.ClientReady, (readyClient: Client<true>) => {
            readyClient.user.setStatus(PresenceUpdateStatus.Invisible);
            console.log(`🤖 Discord bot ready! Logged in as ${readyClient.user.tag}`);
            console.log(`📊 Bot is in ${readyClient.guilds.cache.size} servers`);
            isReadyState = true;
        });

        client.on(Events.Error, (error: Error) => {
            console.error("❌ Discord client error:", error);
        });

        client.on(RESTEvents.RateLimited, rateLimitData => {
            console.warn("⚠️ Rate limited:");
            console.log(`Route: ${rateLimitData.route}`);
            console.log(`Method: ${rateLimitData.method}`);
            console.log(`Retry after: ${rateLimitData.retryAfter}ms`);
            console.log(`Global: ${rateLimitData.global}`);
        });
    };

    const start = async (): Promise<void> => {
        try {
            console.log("🚀 Starting Discord bot...");
            const botStartTime = Date.now();

            console.log("⏱️  Creating Discord client...");
            if (!clientHandle.hasClient() || clientHandle.isDestroyed()) {
                const client = clientHandle.create();
                setupBaseEventHandlers(client);
                application.registerEvents(registerEventHandler);
            }
            console.log(`✅ Client created in ${Date.now() - botStartTime}ms`);

            console.log("⏱️  Logging in to Discord...");
            const loginStart = Date.now();
            const client = clientHandle.client;
            await client.login(config.discord.token);
            console.log(`✅ Discord login and ready in ${Date.now() - loginStart}ms`);

            console.log("⏱️  Fetching guild...");
            const guildStart = Date.now();
            const guild = await client.guilds.fetch(config.discord.serverId);
            await guild.fetch();
            console.log(`✅ Guild fetched in ${Date.now() - guildStart}ms`);

            await application.onReady({ client: client as Client<true>, guild });

            client.user?.setStatus(PresenceUpdateStatus.Online);
            console.log(`✅ Discord bot fully started in ${Date.now() - botStartTime}ms`);
        } catch (error) {
            console.error("❌ Failed to start Discord bot:", error);
            throw error;
        }
    };

    const stop = async (): Promise<void> => {
        try {
            console.log("🛑 Stopping Discord bot...");
            isReadyState = false;

            await sleep(50);

            if (clientHandle.hasClient() && !clientHandle.isDestroyed()) {
                clientHandle.client.user?.setStatus(PresenceUpdateStatus.Invisible);
            }

            await clientHandle.destroy();
            console.log("✅ Discord bot stopped");
        } catch (error) {
            console.error("❌ Error stopping Discord bot:", error);
            throw error;
        }
    };

    return {
        get client() {
            return clientHandle.client;
        },
        isReady: () => isReadyState,
        start,
        stop,
        registerEventHandler,
    };
};
