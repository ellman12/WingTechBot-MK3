export const loadEnvironment = async (): Promise<void> => {
    // Skip loading .env file if:
    // 1. In CI environment (variables provided by CI/CD)
    // 2. In production (variables provided by Docker Compose via env_file or other means)
    if (process.env.CI || process.env.NODE_ENV === "production") {
        return;
    }

    try {
        await import("@dotenvx/dotenvx/config");
    } catch {
        if (process.env.NODE_ENV !== "test") {
            console.warn("⚠️  Could not load .env file (this is OK if environment variables are set directly)");
        }
    }
};
