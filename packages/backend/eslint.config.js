import rootConfig from "../../eslint.config.js";
import localRules from "./eslint-local-rules.js";

export default [
    ...rootConfig,
    {
        files: ["**/*.{ts,tsx}"],
        plugins: {
            local: localRules,
        },
        rules: {
            "local/require-js-extension-for-path-aliases": "error",
            "local/single-line-it-calls": "warn",
        },
    },
];
