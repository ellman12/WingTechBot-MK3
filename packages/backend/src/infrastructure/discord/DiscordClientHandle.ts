import { Client, GatewayIntentBits, Partials } from "discord.js";

//Owns the lifetime of the discord.js Client. A DiscordBot can be stopped and started again, which needs a fresh Client,
//so anything that must talk to "the current client" (e.g. the voice adapter) holds this handle rather than a Client.
export type DiscordClientHandle = {
    readonly client: Client;
    readonly hasClient: () => boolean;
    readonly isDestroyed: () => boolean;
    readonly create: () => Client;
    readonly destroy: () => Promise<void>;
};

const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
];

const partials = [Partials.User, Partials.GuildMember, Partials.ThreadMember, Partials.Channel, Partials.Message, Partials.Reaction];

export const createDiscordClientHandle = (): DiscordClientHandle => {
    let client: Client | undefined;
    let destroyed = false;

    return {
        get client(): Client {
            if (!client) throw new Error("Discord client has not been created yet. Call start() on the bot first.");
            return client;
        },
        hasClient: () => client !== undefined,
        isDestroyed: () => destroyed,
        create: () => {
            client = new Client({ intents, partials });
            destroyed = false;
            return client;
        },
        destroy: async () => {
            if (!client || destroyed) return;
            await client.destroy();
            destroyed = true;
        },
    };
};
