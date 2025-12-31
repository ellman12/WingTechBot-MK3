import type { Config } from "@infrastructure/config/Config.js";
import xxhash from "xxhash-wasm";

export type ErrorReportingService = {
    readonly reportError: (error: Error | unknown, context?: Record<string, unknown>) => Promise<void>;
    readonly shutdown: () => void;
};

export type ErrorReportingServiceDeps = {
    readonly config: Config;
};

type DiscordEmbed = {
    readonly title: string;
    readonly description: string;
    readonly color: number;
    readonly fields: Array<{ readonly name: string; readonly value: string; readonly inline?: boolean }>;
    readonly timestamp: string;
};

export const createErrorReportingService = async ({ config }: ErrorReportingServiceDeps): Promise<ErrorReportingService> => {
    const webhookUrl = config.discord.errorWebhookUrl;
    const environment = config.server.environment;

    const hasher = await xxhash();

    const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
    const MAX_ERRORS_PER_WINDOW = 10;
    const errorTimestamps: number[] = [];

    const DEDUPE_WINDOW_MS = 300000; // 5 minutes
    const recentErrorHashes = new Map<string, number>();

    const originalConsoleError = console.error;

    // Monkey-patch console.error to report errors to Discord
    console.error = (...args: unknown[]): void => {
        originalConsoleError(...args);

        const firstArg = args[0];
        const error = firstArg instanceof Error ? firstArg : new Error(String(firstArg));
        const context = args.length > 1 ? { additionalArgs: args.slice(1) } : undefined;

        void reportError(error, context);
    };

    console.log("[ErrorReportingService] Initialized - console.error intercepted");
    if (webhookUrl) {
        console.log("[ErrorReportingService] Discord webhook configured");
    } else {
        console.log("[ErrorReportingService] No webhook URL configured, errors will not be sent to Discord");
    }

    const cleanup = (): void => {
        const now = Date.now();

        const cutoff = now - RATE_LIMIT_WINDOW_MS;
        const validTimestamps = errorTimestamps.filter(ts => ts >= cutoff);
        errorTimestamps.length = 0;
        errorTimestamps.push(...validTimestamps);

        for (const [hash, timestamp] of recentErrorHashes.entries()) {
            if (timestamp < now - DEDUPE_WINDOW_MS) {
                recentErrorHashes.delete(hash);
            }
        }
    };

    const isWithinRateLimit = (): boolean => {
        cleanup();
        return errorTimestamps.length < MAX_ERRORS_PER_WINDOW;
    };

    const generateErrorHash = (errorType: string, message: string, stack?: string): string => {
        const stackLines = stack?.split("\n").slice(0, 3).join("\n") || "";
        const hashInput = `${errorType}:${message}:${stackLines}`;
        return hasher.h64ToString(hashInput);
    };

    const isDuplicate = (hash: string): boolean => {
        cleanup();
        return recentErrorHashes.has(hash);
    };

    const markAsSeen = (hash: string): void => {
        recentErrorHashes.set(hash, Date.now());
    };

    const truncate = (str: string, maxLength: number): string => {
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength - 3) + "...";
    };

    const truncateStackTrace = (stack: string, maxLength: number): string => {
        const lines = stack.split("\n");

        if (lines.length <= 35) {
            return truncate(stack, maxLength);
        }

        const firstLines = lines.slice(0, 30);
        const lastLines = lines.slice(-5);
        const truncated = [...firstLines, "... (truncated) ...", ...lastLines].join("\n");

        return truncate(truncated, maxLength);
    };

    const codeBlock = (content: string, language = ""): string => {
        return `\`\`\`${language}\n${content}\n\`\`\``;
    };

    const getErrorType = (error: unknown): string => {
        if (error instanceof Error) {
            if (error.name) {
                return error.name;
            }
            return error.constructor.name;
        }
        return "UnknownError";
    };

    const getErrorMessage = (error: unknown): string => {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    };

    const getStackTrace = (error: unknown): string | undefined => {
        if (error instanceof Error && error.stack) {
            return error.stack;
        }
        return undefined;
    };

    const extractErrorContext = (error: unknown): Record<string, unknown> | undefined => {
        if (error && typeof error === "object" && "context" in error) {
            const { context } = error;
            if (context && typeof context === "object" && !Array.isArray(context)) {
                return context as Record<string, unknown>;
            }
        }
        return undefined;
    };

    const formatErrorEmbed = (error: unknown, additionalContext?: Record<string, unknown>): DiscordEmbed => {
        const errorType = getErrorType(error);
        const message = getErrorMessage(error);
        const stack = getStackTrace(error);
        const errorContext = extractErrorContext(error);
        const timestamp = new Date().toISOString();

        // No sanitization needed as contexts contain only technical metadata
        const combinedContext = { ...errorContext, ...additionalContext };

        const fields: Array<{ readonly name: string; readonly value: string; readonly inline?: boolean }> = [
            { name: "Error Type", value: errorType, inline: true },
            { name: "Environment", value: environment.toUpperCase(), inline: true },
        ];

        if (stack) {
            const truncatedStack = truncateStackTrace(stack, 1000);
            fields.push({
                name: "Stack Trace",
                value: codeBlock(truncatedStack, "javascript"),
                inline: false,
            });
        }

        if (combinedContext && Object.keys(combinedContext).length > 0) {
            const contextString = JSON.stringify(combinedContext, null, 2);
            fields.push({
                name: "Context",
                value: codeBlock(truncate(contextString, 900), "json"),
                inline: false,
            });
        }

        return {
            title: truncate(`🔴 ${errorType} [${environment.toUpperCase()}]`, 256),
            description: truncate(message, 4096),
            color: 0xff0000,
            fields,
            timestamp,
        };
    };

    const sendToWebhook = async (embed: DiscordEmbed): Promise<void> => {
        if (!webhookUrl) {
            return; // Silently skip if webhook not configured
        }

        try {
            const response = await fetch(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ embeds: [embed] }),
            });

            if (!response.ok) {
                // Use original console.error to avoid error loop
                originalConsoleError(`[ErrorReportingService] Webhook failed: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            // Never throw to avoid infinite loop
            originalConsoleError("[ErrorReportingService] Webhook error:", error);
        }
    };

    const reportError = async (error: Error | unknown, context?: Record<string, unknown>): Promise<void> => {
        try {
            const errorType = getErrorType(error);
            const message = getErrorMessage(error);
            const stack = getStackTrace(error);

            const hash = generateErrorHash(errorType, message, stack);

            if (isDuplicate(hash)) {
                originalConsoleError(`[ErrorReportingService] Skipping duplicate error: ${errorType}`);
                return;
            }

            if (!isWithinRateLimit()) {
                originalConsoleError(`[ErrorReportingService] Rate limit exceeded, skipping error: ${errorType}`);
                return;
            }

            markAsSeen(hash);
            errorTimestamps.push(Date.now());

            const embed = formatErrorEmbed(error, context);
            await sendToWebhook(embed);
        } catch (error) {
            // Never throw to avoid error loop
            originalConsoleError("[ErrorReportingService] Error in reportError:", error);
        }
    };

    const shutdown = (): void => {
        console.error = originalConsoleError;
        console.log("[ErrorReportingService] Shutdown - console.error restored");
    };

    return {
        reportError,
        shutdown,
    };
};
