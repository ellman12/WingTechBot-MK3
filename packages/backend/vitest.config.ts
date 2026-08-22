/// <reference types="vitest" />
import { resolve } from "path";
import { defineConfig, defineProject, mergeConfig } from "vitest/config";

// Shared alias configuration
const aliasConfig = {
    "@": resolve(__dirname, "./src"),
    "@core": resolve(__dirname, "./src/core"),
    "@infrastructure": resolve(__dirname, "./src/infrastructure"),
    "@application": resolve(__dirname, "./src/application"),
    "@adapters": resolve(__dirname, "./src/adapters"),
    "@db": resolve(__dirname, "./database"),
};

// Base config shared across all projects
const baseConfig = defineConfig({
    resolve: {
        alias: aliasConfig,
    },
});

// Shared test configuration
const baseTestConfig = {
    globals: true,
    environment: "node" as const,
    setupFiles: ["./tests/setup.ts"],
    coverage: {
        provider: "v8" as const,
        reporter: ["text", "json", "html"],
        exclude: ["node_modules/", "dist/", "coverage/", "src/generated/", "**/*.d.ts", "**/*.config.ts", "**/index.ts"],
    },
    exclude: ["node_modules/", "dist/", "coverage/"],
};

export default defineConfig({
    test: {
        ...baseTestConfig,
        // Use projects to handle different parallelism requirements
        projects: [
            defineProject(
                mergeConfig(baseConfig, {
                    test: {
                        ...baseTestConfig,
                        name: "discord-integration",
                        include: ["tests/integration/messagesAndReactions/**/*.{test,spec}.{js,ts}", "tests/integration/fullApplication.{test,spec}.{js,ts}"],
                        fileParallelism: true,
                        pool: "forks",
                        poolOptions: {
                            forks: {
                                singleFork: false,
                            },
                        },
                    },
                })
            ),
            defineProject(
                mergeConfig(baseConfig, {
                    test: {
                        ...baseTestConfig,
                        name: "unit-and-audio",
                        include: ["tests/unit/**/*.{test,spec}.{js,ts}", "tests/integration/audio/**/*.{test,spec}.{js,ts}"],
                        fileParallelism: true,
                    },
                })
            ),
        ],
    },
    resolve: {
        alias: aliasConfig,
    },
});
