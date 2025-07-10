import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

import type { DB } from '../../generated/database/types.js';
import { PrismaClient } from '../../generated/prisma/index.js';

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private readonly prisma: PrismaClient;
  private readonly kysely: Kysely<DB>;

  private constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });

    // Create Kysely instance with PostgreSQL
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    this.kysely = new Kysely<DB>({
      dialect: new PostgresDialect({
        pool,
      }),
    });
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }

    return DatabaseConnection.instance;
  }

  public getPrisma(): PrismaClient {
    return this.prisma;
  }

  public getKysely(): Kysely<DB> {
    return this.kysely;
  }

  public async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      console.log('✅ Database connected successfully');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      await this.kysely.destroy();
      console.log('✅ Database disconnected successfully');
    } catch (error) {
      console.error('❌ Database disconnection failed:', error);
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
