import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config([
    globalIgnores(["dist", "dist/**/*", "**/dist/**/*", "node_modules", "node_modules/**/*", "build", "build/**/*", "coverage", "coverage/**/*", ".next", ".next/**/*", "out", "out/**/*", "*.d.ts", "*.js.map", "*.css.map", ".eslintcache"]),
    {
        files: ["**/*.{ts,tsx}"],
        extends: [
            js.configs.recommended,
            tseslint.configs.recommended,
            reactHooks.configs["recommended-latest"],
            reactRefresh.configs.vite,
            prettier, // disables formatting rules conflicting with Prettier
        ],
        languageOptions: { ecmaVersion: 2020, globals: globals.browser },
        rules: {
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
        },
    },
]);
