import { type Config, configSchema } from "@core/config/Config.js";
import { z } from "zod";

export const loadConfig = (envPrefix: "" | "TESTER_" = ""): Config => {
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
            skipChannelProcessingOnStartup: process.env.SKIP_CHANNEL_PROCESSING_ON_STARTUP,
            skipCommandDeploymentOnStartup: process.env.SKIP_COMMAND_DEPLOYMENT_ON_STARTUP,
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
            instructionsPath: process.env.LLM_INSTRUCTIONS_PATH,
        },
        autoReaction: {
            funnySubstringsProbability: process.env.AUTO_REACTION_FUNNY_SUBSTRINGS_PROBABILITY,
            erJokeProbability: process.env.AUTO_REACTION_ER_JOKE_PROBABILITY,
            nekoizeProbability: process.env.AUTO_REACTION_NEKOIZE_PROBABILITY,
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
            // Don't exit process in test environments - throw error instead
            if (process.env.NODE_ENV === "test" || process.env.CI) {
                throw new Error("Configuration validation failed. See errors above.");
            }
            process.exit(1);
        }
        throw error;
    }
};

// Legacy getConfig for backward compatibility - creates a new config instance each time
// Prefer passing config through dependency injection
export const getConfig = (configType: "default" | "tester" = "default"): Config => {
    const envPrefix = configType === "tester" ? "TESTER_" : "";
    return loadConfig(envPrefix);
};
