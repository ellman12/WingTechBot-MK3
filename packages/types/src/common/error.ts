// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

// Common error types
export interface ValidationError {
  readonly path: string;
  readonly message: string;
}

export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly statusCode: HttpStatus;
  readonly details?: ValidationError[];
}

// Specific error types
export class GuildNotFoundError extends Error {
  readonly code = 'GUILD_NOT_FOUND';
  readonly statusCode = HTTP_STATUS.NOT_FOUND;

  constructor(message: string) {
    super(message);
    this.name = 'GuildNotFoundError';
  }
}

export class UserNotFoundError extends Error {
  readonly code = 'USER_NOT_FOUND';
  readonly statusCode = HTTP_STATUS.NOT_FOUND;

  constructor(message: string) {
    super(message);
    this.name = 'UserNotFoundError';
  }
}

export class ValidationFailedError extends Error {
  readonly code = 'VALIDATION_FAILED';
  readonly statusCode = HTTP_STATUS.BAD_REQUEST;
  readonly details: ValidationError[];

  constructor(message: string, details: ValidationError[] = []) {
    super(message);
    this.name = 'ValidationFailedError';
    this.details = details;
  }
}

export class ConflictError extends Error {
  readonly code = 'CONFLICT';
  readonly statusCode = HTTP_STATUS.CONFLICT;

  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}
