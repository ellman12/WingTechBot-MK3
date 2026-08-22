import rootConfig from "../../eslint.config.js";
import localRules from "./eslint-local-rules.js";

// Hexagonal layer boundaries. See ARCHITECTURE.md for the rationale behind each rule.
const restrict = patterns => ({ "no-restricted-imports": ["error", { patterns }] });

const noBareAlias = { group: ["@/*"], message: "Use a layer alias (@core, @application, @adapters, @infrastructure) so the import shows which layer you are crossing into." };

export default [
    ...rootConfig,
    {
        files: ["**/*.{ts,tsx}"],
        plugins: {
            local: localRules,
        },
        rules: {
            "local/require-js-extension-for-path-aliases": "error",
        },
    },
    {
        files: ["src/core/**/*.ts"],
        rules: restrict([
            noBareAlias,
            {
                group: ["@adapters/*", "@application/*", "@infrastructure/*", "@db/*", "**/adapters/**", "**/application/**", "**/infrastructure/**", "**/database/**"],
                message: "core must not depend on outer layers. Define a port in core/ports and let an adapter implement it.",
            },
            {
                group: ["discord.js", "@discordjs/*", "kysely", "pg", "express", "@google/genai", "fluent-ffmpeg", "@wingtechbot-mk3/types", "@wingtechbot-mk3/types/*"],
                message: "core must stay framework/vendor-free. Map vendor types to plain data in application/ or wrap the vendor in adapters/.",
            },
        ]),
    },
    {
        files: ["src/application/**/*.ts"],
        rules: restrict([
            noBareAlias,
            { group: ["@adapters/*", "@infrastructure/*", "@db/*", "**/adapters/**", "**/infrastructure/**", "**/database/**"], message: "application may only depend on core (via ports) and its own layer. Concrete adapters are wired in main.ts." },
            { group: ["kysely", "pg", "@google/genai", "fluent-ffmpeg"], message: "application must not touch persistence/vendor SDKs directly; go through a core port." },
        ]),
    },
    {
        files: ["src/adapters/**/*.ts"],
        rules: restrict([noBareAlias, { group: ["@application/*", "**/application/**"], message: "adapters implement core ports and must not depend on the application layer." }]),
    },
    {
        files: ["src/infrastructure/**/*.ts"],
        rules: restrict([noBareAlias, { group: ["@adapters/*", "**/adapters/**"], message: "infrastructure must not depend on adapters (adapters depend on infrastructure's tech wrappers); wire concrete adapters in main.ts." }]),
    },
];
