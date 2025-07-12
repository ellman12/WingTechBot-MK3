/// <reference types="vitest" />
import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        setupFiles: ["./tests/setup.ts"],
        coverage: { provider: "v8", reporter: ["text", "json", "html"], exclude: ["node_modules/", "dist/", "coverage/", "src/generated/", "**/*.d.ts", "**/*.config.ts", "**/index.ts"] },
        include: ["tests/**/*.{test,spec}.{js,ts}"],
        exclude: ["node_modules/", "dist/", "coverage/"],
    },
    resolve: {
        alias: {
            "@": resolve(__dirname, "./src"),
            "@core": resolve(__dirname, "./src/core"),
            "@infrastructure": resolve(__dirname, "./src/infrastructure"),
            "@application": resolve(__dirname, "./src/application"),
            "@adapters": resolve(__dirname, "./src/adapters"),
            "@wingtechbot-mk3/types/entities/guild": resolve(__dirname, "../types/src/entities/guild.ts"),
            "@wingtechbot-mk3/types/entities/user": resolve(__dirname, "../types/src/entities/user.ts"),
            "@wingtechbot-mk3/types/api/v1/common": resolve(__dirname, "../types/src/api/v1/common.ts"),
            "@wingtechbot-mk3/types/api/v1/guilds": resolve(__dirname, "../types/src/api/v1/guilds.ts"),
            "@wingtechbot-mk3/types/api/v1/health": resolve(__dirname, "../types/src/api/v1/health.ts"),
        },
    },
});
