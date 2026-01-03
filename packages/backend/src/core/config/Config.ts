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
    defaultVoiceChannelId: z.string().default(""),
    roleId: z.string().default(""),
    errorWebhookUrl: z
        .string()
        .refine(val => !val || val === "" || URL.canParse(val), "Must be a valid URL or empty string")
        .optional(),
    skipChannelProcessingOnStartup: z.coerce.boolean().default(false),
    skipCommandDeploymentOnStartup: z.coerce.boolean().default(false),
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
    instructionsPath: z.string().default("./llmInstructions"),
    disabled: z.coerce.boolean().default(false),
});

const autoReactionConfigSchema = z.object({
    funnySubstringsProbability: z.coerce.number().int().positive().default(10),
    erJokeProbability: z.coerce.number().int().positive().default(50),
    nekoizeProbability: z.coerce.number().int().positive().default(1000),
    eliottReminderProbability: z.coerce.number().int().positive().default(1),
});

export const configSchema = z.object({
    server: serverConfigSchema,
    database: databaseConfigSchema,
    discord: discordConfigSchema,
    sounds: soundsConfigSchema,
    cache: cacheConfigSchema,
    ffmpeg: ffmpegConfigSchema,
    llm: llmConfigSchema,
    autoReaction: autoReactionConfigSchema,
});

export type Config = z.infer<typeof configSchema>;
