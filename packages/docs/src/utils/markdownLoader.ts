// Import markdown content as strings
import apiContent from "../content/api.md?raw";
import architectureContent from "../content/architecture.md?raw";
import databaseContent from "../content/database.md?raw";
import deploymentContent from "../content/deployment.md?raw";
import developmentContent from "../content/development.md?raw";
import discordBotContent from "../content/discord-bot.md?raw";
import frontendContent from "../content/frontend.md?raw";
import installationContent from "../content/installation.md?raw";
import quickStartContent from "../content/quick-start.md?raw";

// Content map for easy access
export const MARKDOWN_CONTENT = {
    "quick-start": quickStartContent,
    installation: installationContent,
    development: developmentContent,
    architecture: architectureContent,
    api: apiContent,
    database: databaseContent,
    "discord-bot": discordBotContent,
    frontend: frontendContent,
    deployment: deploymentContent,
} as const;

export type MarkdownPath = keyof typeof MARKDOWN_CONTENT;

export function loadMarkdownContent(path: MarkdownPath): string {
    return MARKDOWN_CONTENT[path] || `# Content Not Found\n\nThe requested content could not be loaded.`;
}
