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

export interface ValidationError extends Error {
    code: "VALIDATION_ERROR";
    status: HttpStatus.BAD_REQUEST;
    details?: Record<string, unknown>;
}

export interface NotFoundError extends Error {
    code: "NOT_FOUND";
    status: HttpStatus.NOT_FOUND;
}

export interface ConflictError extends Error {
    code: "CONFLICT";
    status: HttpStatus.CONFLICT;
}

export const createValidationError = (message: string, details?: Record<string, unknown>): ValidationError => {
    const error = new Error(message) as ValidationError;
    error.name = "ValidationError";
    error.code = "VALIDATION_ERROR";
    error.status = HttpStatus.BAD_REQUEST;
    error.details = details;
    return error;
};

export const createNotFoundError = (message: string): NotFoundError => {
    const error = new Error(message) as NotFoundError;
    error.name = "NotFoundError";
    error.code = "NOT_FOUND";
    error.status = HttpStatus.NOT_FOUND;
    return error;
};

export const createConflictError = (message: string): ConflictError => {
    const error = new Error(message) as ConflictError;
    error.name = "ConflictError";
    error.code = "CONFLICT";
    error.status = HttpStatus.CONFLICT;
    return error;
};
