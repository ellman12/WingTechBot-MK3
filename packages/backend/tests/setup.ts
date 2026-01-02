import { loadConfig } from "@adapters/config/ConfigAdapter.js";
import type { Config } from "@core/config/Config.js";
import { config } from "@dotenvx/dotenvx";
import path from "path";

// Load test environment variables from .env.test file (skip in CI where vars are provided by CI/CD)
if (!process.env.CI) {
    const testEnvPath = path.resolve(__dirname, "./integration/testBot/.env.test");
    config({ path: testEnvPath, strict: true });
}

// Export test config with 100% auto-reaction probabilities for reliable testing
// This is used by test files to initialize the app with test config
export const getTestConfig = (): Config => {
    const baseConfig = loadConfig();

    return {
        ...baseConfig,
        llm: {
            ...baseConfig.llm,
            apiKey: "test-api-key",
            disabled: true,
        },
        discord: {
            ...baseConfig.discord,
            skipChannelProcessingOnStartup: true,
            skipCommandDeploymentOnStartup: true,
            restrictToChannelIds: [], // Start with empty array - test channels will be added here
        },
        autoReaction: {
            funnySubstringsProbability: 1,
            erJokeProbability: 1,
            nekoizeProbability: 1,
        },
    };
};
