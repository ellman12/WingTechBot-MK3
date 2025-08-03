import type { DB } from "@db/types";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

let kyselyInstance: Kysely<DB> | null = null;
let isConnected = false;

const createKyselyClient = (): Kysely<DB> => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
};

export const getKysely = (): Kysely<DB> => {
    if (!kyselyInstance) {
        kyselyInstance = createKyselyClient();
    }
    return kyselyInstance;
};

export const connect = async (): Promise<void> => {
    if (isConnected) {
        console.log("✅ Database already connected");
        return;
    }

    try {
        const kysely = getKysely();

        await kysely.selectFrom("users").select("id").limit(1).execute();

        isConnected = true;
        console.log("✅ Database connected successfully");
    } catch (error) {
        console.error("❌ Database connection failed:", error);
        throw error;
    }
};

export const disconnect = async (): Promise<void> => {
    try {
        const kysely = getKysely();
        await kysely.destroy();

        isConnected = false;
        console.log("✅ Database disconnected successfully");
    } catch (error) {
        console.error("❌ Database disconnection failed:", error);
        throw error;
    }
};

export const healthCheck = async (): Promise<boolean> => {
    try {
        const kysely = getKysely();
        await kysely.selectFrom("users").select("id").limit(1).execute();
        return true;
    } catch {
        return false;
    }
};

export const isDatabaseConnected = (): boolean => {
    return isConnected;
};
