export interface Config {
  readonly server: {
    readonly port: number;
    readonly environment: string;
  };
  readonly database: {
    readonly url: string;
  };
  readonly discord: {
    readonly token: string;
    readonly clientId: string;
    readonly guildId?: string;
  };
}

export class ConfigService {
  private static instance: ConfigService;
  private readonly config: Config;

  private constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }

    return ConfigService.instance;
  }

  public getConfig(): Config {
    return this.config;
  }

  private loadConfig(): Config {
    return {
      server: {
        port: Number(process.env.PORT) || 3000,
        environment: process.env.NODE_ENV || 'development',
      },
      database: {
        url:
          process.env.DATABASE_URL ||
          'postgresql://wingtechbot:wingtechbot_password@localhost:5432/wingtechbot',
      },
      discord: {
        token: process.env.DISCORD_TOKEN || '',
        clientId: process.env.DISCORD_CLIENT_ID || '',
        ...(process.env.DISCORD_GUILD_ID && { guildId: process.env.DISCORD_GUILD_ID }),
      },
    };
  }

  private validateConfig(): void {
    const errors: string[] = [];

    if (!this.config.discord.token) {
      errors.push('DISCORD_TOKEN is required');
    }

    if (!this.config.discord.clientId) {
      errors.push('DISCORD_CLIENT_ID is required');
    }

    if (!this.config.database.url) {
      errors.push('DATABASE_URL is required');
    }

    if (this.config.server.port < 1 || this.config.server.port > 65535) {
      errors.push('PORT must be between 1 and 65535');
    }

    if (errors.length > 0) {
      console.error('Configuration validation failed:');
      errors.forEach(error => console.error(`  - ${error}`));
      process.exit(1);
    }
  }
}
