// ============================================================================
// Error Types and HTTP Status Codes
// ============================================================================

export enum HttpStatus {
    OK = 200,
    CREATED = 201,
    NO_CONTENT = 204,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    CONFLICT = 409,
    UNPROCESSABLE_ENTITY = 422,
    INTERNAL_SERVER_ERROR = 500,
    BAD_GATEWAY = 502,
    SERVICE_UNAVAILABLE = 503,
}

export interface ApiError {
    readonly code: string;
    readonly message: string;
    readonly status: HttpStatus;
    readonly details?: Record<string, unknown>;
}

export class ValidationError extends Error {
    readonly code = "VALIDATION_ERROR";
    readonly status = HttpStatus.BAD_REQUEST;

    constructor(
        message: string,
        public readonly details?: Record<string, unknown>
    ) {
        super(message);
        this.name = "ValidationError";
    }
}

export class NotFoundError extends Error {
    readonly code = "NOT_FOUND";
    readonly status = HttpStatus.NOT_FOUND;

    constructor(message: string) {
        super(message);
        this.name = "NotFoundError";
    }
}

export class ConflictError extends Error {
    readonly code = "CONFLICT";
    readonly status = HttpStatus.CONFLICT;

    constructor(message: string) {
        super(message);
        this.name = "ConflictError";
    }
}
