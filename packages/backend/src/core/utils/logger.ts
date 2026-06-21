// Lightweight leveled logger.
//
// Goals:
//  - Readable from the console (single source of truth for stdout/stderr output).
//  - Quality errors forwarded to the Discord error channel via an injectable reporter,
//    so we never have to monkey-patch the global console.
//  - Drop-in compatible with console.* (variadic args) so call sites read naturally:
//      logger.debug("[PcmMixer] added stream", id);
//      logger.error("[VoiceService] failed to connect", err, { serverId });
//
// Level is controlled by the LOG_LEVEL env var (debug | info | warn | error | silent).
// Defaults to "info", so the verbose per-operation audio logs (logger.debug) stay quiet
// in production but can be switched on with LOG_LEVEL=debug.

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export type ErrorReporter = (error: Error | unknown, context?: Record<string, unknown>) => void | Promise<void>;

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    silent: 100,
};

const resolveInitialLevel = (): LogLevel => {
    const fromEnv = process.env.LOG_LEVEL?.toLowerCase();
    if (fromEnv && fromEnv in LEVEL_PRIORITY) {
        return fromEnv as LogLevel;
    }
    return "info";
};

let currentLevel: LogLevel = resolveInitialLevel();
let errorReporter: ErrorReporter | null = null;

const isEnabled = (level: LogLevel): boolean => LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];

// Pull the most useful Error out of a console-style argument list and turn the rest into
// structured context, so the Discord report keeps the real stack trace instead of a
// stringified wrapper.
const buildReport = (args: unknown[]): { error: Error; context?: Record<string, unknown> } => {
    const errorArg = args.find((a): a is Error => a instanceof Error);
    const rest = args.filter(a => a !== errorArg);

    const message = rest
        .filter((a): a is string => typeof a === "string")
        .join(" ")
        .trim();
    const extras = rest.filter(a => typeof a !== "string");

    const error = errorArg ?? new Error(message || "Unknown error");

    const context: Record<string, unknown> = {};
    if (errorArg && message) context.logMessage = message;
    if (extras.length > 0) context.additionalArgs = extras;

    return { error, context: Object.keys(context).length > 0 ? context : undefined };
};

export const logger = {
    setLevel(level: LogLevel): void {
        currentLevel = level;
    },

    getLevel(): LogLevel {
        return currentLevel;
    },

    // Wire in a sink for error-level logs (e.g. the Discord ErrorReportingService).
    setErrorReporter(reporter: ErrorReporter | null): void {
        errorReporter = reporter;
    },

    debug(...args: unknown[]): void {
        if (isEnabled("debug")) console.log(...args);
    },

    info(...args: unknown[]): void {
        if (isEnabled("info")) console.log(...args);
    },

    warn(...args: unknown[]): void {
        if (isEnabled("warn")) console.warn(...args);
    },

    error(...args: unknown[]): void {
        if (isEnabled("error")) console.error(...args);

        // Forward to the error channel regardless of the console gate (but not when silenced),
        // so production incidents still reach Discord even with a quiet console.
        if (errorReporter && currentLevel !== "silent") {
            const { error, context } = buildReport(args);
            void errorReporter(error, context);
        }
    },
};
