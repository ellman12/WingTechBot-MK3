export class GuildNotFoundError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'GuildNotFoundError';
  }
}

export class GuildAlreadyExistsError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'GuildAlreadyExistsError';
  }
}

export class InvalidGuildDataError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidGuildDataError';
  }
}

export const createGuildNotFoundError = (message: string): GuildNotFoundError =>
  new GuildNotFoundError(message);

export const createGuildAlreadyExistsError = (message: string): GuildAlreadyExistsError =>
  new GuildAlreadyExistsError(message);

export const createInvalidGuildDataError = (message: string): InvalidGuildDataError =>
  new InvalidGuildDataError(message);
