export interface Config {
    readonly server: { readonly port: number; readonly environment: string };
    readonly database: { readonly url: string };
    readonly discord: { readonly token: string; readonly clientId: string; readonly guildId?: string };
}

// Private state using file-level constants
let configInstance: Config | null = null;

// Private functions
const loadConfig = (): Config => {
    return {
        server: { port: Number(process.env.PORT) || 3000, environment: process.env.NODE_ENV || "development" },
        database: { url: process.env.DATABASE_URL || "postgresql://wingtechbot:wingtechbot_password@localhost:5432/wingtechbot" },
        discord: { token: process.env.DISCORD_TOKEN || "", clientId: process.env.DISCORD_CLIENT_ID || "", ...(process.env.DISCORD_GUILD_ID && { guildId: process.env.DISCORD_GUILD_ID }) },
    };
};

const validateConfig = (config: Config): void => {
    const errors: string[] = [];

    if (!config.discord.token) {
        errors.push("DISCORD_TOKEN is required");
    }

    if (!config.discord.clientId) {
        errors.push("DISCORD_CLIENT_ID is required");
    }

    if (!config.database.url) {
        errors.push("DATABASE_URL is required");
    }

    if (config.server.port < 1 || config.server.port > 65535) {
        errors.push("PORT must be between 1 and 65535");
    }

    if (errors.length > 0) {
        console.error("Configuration validation failed:");
        errors.forEach(error => console.error(`  - ${error}`));
        process.exit(1);
    }
};

// Public interface - exported functions
export const getConfig = (): Config => {
    if (!configInstance) {
        configInstance = loadConfig();
        validateConfig(configInstance);
    }
    return configInstance;
};

export const resetConfig = (): void => {
    configInstance = null;
};
