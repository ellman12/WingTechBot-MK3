import type { Config } from "@core/config/Config.js";
import type { DB } from "@db/types.js";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

export type DatabaseConnection = {
    readonly getKysely: () => Kysely<DB>;
    readonly connect: () => Promise<void>;
    readonly disconnect: () => Promise<void>;
    readonly healthCheck: () => Promise<boolean>;
};

export const createDatabaseConnection = (config: Config, schemaName?: string): DatabaseConnection => {
    const connectionString = config.database.url;
    const sanitizedSchema = schemaName?.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();

    const pool = new Pool({ connectionString });

    // Set search_path for every new connection in the pool
    // This ensures all queries use the correct schema
    // Reference: https://node-postgres.com/apis/pool
    if (sanitizedSchema) {
        pool.on("connect", client => {
            return client.query(`SET search_path TO ${sanitizedSchema}`);
        });
    }

    const kysely = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });

    let isConnected = false;

    return {
        getKysely: () => kysely,
        connect: async () => {
            if (isConnected) {
                console.log("✅ Database already connected");
                return;
            }
            isConnected = true;
        },
        disconnect: async () => {
            try {
                await kysely.destroy();
                isConnected = false;
                console.log("✅ Database disconnected successfully");
            } catch (error) {
                console.error("❌ Database disconnection failed:", error);
                throw error;
            }
        },
        healthCheck: async () => {
            try {
                await kysely.selectFrom("users").select("id").limit(1).execute();
                return true;
            } catch {
                return false;
            }
        },
    };
};
