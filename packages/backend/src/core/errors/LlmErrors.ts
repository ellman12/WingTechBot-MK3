export class LlmError extends Error {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = "LlmError";
    }
}

//The LLM backend rejected or could not serve the request (rate limit, outage, auth, quota).
export class LlmUnavailableError extends LlmError {
    constructor(message = "LLM service unavailable", options?: { cause?: unknown }) {
        super(message, options);
        this.name = "LlmUnavailableError";
    }
}
