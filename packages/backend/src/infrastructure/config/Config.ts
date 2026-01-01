import { z } from "zod";

const serverConfigSchema = z.object({
    port: z.coerce.number().min(1, "PORT must be at least 1").max(65535, "PORT must be at most 65535").default(3000),
    environment: z.string().default("development"),
});

const databaseConfigSchema = z.object({
    url: z.string().min(1, "DATABASE_URL is required"),
});

const discordConfigSchema = z.object({
    token: z.string().min(1, "Discord token is required"),
    clientId: z.string().min(1, "Discord client ID is required"),
    serverId: z.string(),
    botChannelId: z.string(),
    defaultVoiceChannelId: z.string(),
    roleId: z.string(),
    errorWebhookUrl: z
        .string()
        .refine(val => !val || val === "" || URL.canParse(val), "Must be a valid URL or empty string")
        .optional(),
});

const soundsConfigSchema = z.object({
    storagePath: z.string().default("./sounds"),
});

const cacheConfigSchema = z.object({
    audioDownloadPath: z.string().default("./cache/audio"),
    ttlHours: z.coerce.number().positive().default(24),
    maxSizeMb: z.coerce.number().positive().default(1000),
});

const ffmpegConfigSchema = z.object({
    ffmpegPath: z.string().optional(),
    ffprobePath: z.string().optional(),
});

const llmConfigSchema = z.object({
    apiKey: z.string(),
});

const configSchema = z.object({
    server: serverConfigSchema,
    database: databaseConfigSchema,
    discord: discordConfigSchema,
    sounds: soundsConfigSchema,
    cache: cacheConfigSchema,
    ffmpeg: ffmpegConfigSchema,
    llm: llmConfigSchema,
});

export type Config = z.infer<typeof configSchema>;

let configInstance: Config | null = null;

const loadConfig = (envPrefix: "" | "TESTER_" = ""): Config => {
    const rawConfig = {
        server: {
            port: process.env.PORT,
            environment: process.env.NODE_ENV,
        },
        database: {
            url: process.env.DATABASE_URL || "postgresql://wingtechbot:wingtechbot_password@localhost:5432/wingtechbot",
        },
        discord: {
            token: process.env[`${envPrefix}DISCORD_TOKEN`],
            clientId: process.env[`${envPrefix}DISCORD_CLIENT_ID`],
            serverId: process.env[`${envPrefix}DISCORD_GUILD_ID`],
            botChannelId: process.env[`${envPrefix}DISCORD_BOT_CHANNEL_ID`],
            defaultVoiceChannelId: process.env.DEFAULT_VOICE_CHANNEL_ID,
            roleId: process.env[`${envPrefix}DISCORD_BOT_ROLE_ID`],
            errorWebhookUrl: process.env.DISCORD_ERROR_WEBHOOK_URL,
        },
        sounds: {
            storagePath: process.env.SOUNDS_STORAGE_PATH,
        },
        cache: {
            audioDownloadPath: process.env.AUDIO_CACHE_PATH,
            ttlHours: process.env.AUDIO_CACHE_TTL_HOURS,
            maxSizeMb: process.env.AUDIO_CACHE_MAX_SIZE_MB,
        },
        ffmpeg: {
            ffmpegPath: process.env.FFMPEG_PATH,
            ffprobePath: process.env.FFPROBE_PATH,
        },
        llm: {
            apiKey: process.env.LLM_API_KEY,
        },
    };

    try {
        return configSchema.parse(rawConfig);
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error("Configuration validation failed:");
            error.issues.forEach(err => {
                console.error(`  - ${err.path.join(".")}: ${err.message}`);
            });
            process.exit(1);
        }
        throw error;
    }
};

export const getConfig = (configType: "default" | "tester" = "default"): Config => {
    if (!configInstance) {
        const envPrefix = configType === "tester" ? "TESTER_" : "";
        configInstance = loadConfig(envPrefix);
    }

    return configInstance;
};

export const resetConfig = (): void => {
    configInstance = null;
};
