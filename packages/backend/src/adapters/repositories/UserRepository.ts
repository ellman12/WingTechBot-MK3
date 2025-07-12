import type { CreateUserData, UpdateUserData, User } from "@core/entities/User.js";
import type { UserRepository } from "@core/repositories/UserRepository.js";
import type { Kysely, Selectable } from "kysely";
import type { DB } from "kysely-codegen";

// Private state using file-level constants
let dbInstance: Kysely<DB> | null = null;

// Private functions
const getDatabase = (): Kysely<DB> => {
    if (!dbInstance) {
        throw new Error("UserRepository not initialized. Call initializeUserRepository first.");
    }
    return dbInstance;
};

// Transform database user to domain user (snake_case -> camelCase)
const transformUser = (dbUser: Selectable<DB["users"]>): User => {
    return { id: dbUser.id, username: dbUser.username, ...(dbUser.displayName && { displayName: dbUser.displayName }), ...(dbUser.avatar && { avatar: dbUser.avatar }), isBot: dbUser.isBot, createdAt: dbUser.createdAt, updatedAt: dbUser.updatedAt };
};

// Public interface - exported functions
export const initializeUserRepository = (db: Kysely<DB>): void => {
    dbInstance = db;
};

export const findById = async (id: string): Promise<User | null> => {
    const db = getDatabase();

    const user = await db.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirst();

    return user ? transformUser(user) : null;
};

export const findByUsername = async (username: string): Promise<User | null> => {
    const db = getDatabase();

    const user = await db.selectFrom("users").selectAll().where("username", "=", username).executeTakeFirst();

    return user ? transformUser(user) : null;
};

export const findAll = async (): Promise<User[]> => {
    const db = getDatabase();

    const users = await db.selectFrom("users").selectAll().execute();

    return users.map(transformUser);
};

export const create = async (data: CreateUserData): Promise<User> => {
    const db = getDatabase();

    const [user] = await db
        .insertInto("users")
        .values({ id: data.id, username: data.username, displayName: data.displayName ?? null, avatar: data.avatar ?? null, isBot: data.isBot ?? false, createdAt: new Date(), updatedAt: new Date() })
        .returningAll()
        .execute();

    if (!user) {
        throw new Error("Failed to create user");
    }

    return transformUser(user);
};

export const update = async (id: string, data: UpdateUserData): Promise<User | null> => {
    const db = getDatabase();

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.username !== undefined) {
        updateData.username = data.username;
    }
    if (data.displayName !== undefined) {
        updateData.displayName = data.displayName;
    }
    if (data.avatar !== undefined) {
        updateData.avatar = data.avatar;
    }
    if (data.isBot !== undefined) {
        updateData.isBot = data.isBot;
    }

    const [user] = await db.updateTable("users").set(updateData).where("id", "=", id).returningAll().execute();

    return user ? transformUser(user) : null;
};

export const deleteUser = async (id: string): Promise<boolean> => {
    const db = getDatabase();

    const result = await db.deleteFrom("users").where("id", "=", id).execute();

    return result.length > 0;
};

export const exists = async (id: string): Promise<boolean> => {
    const db = getDatabase();

    const user = await db.selectFrom("users").select("id").where("id", "=", id).executeTakeFirst();

    return !!user;
};

// Export the repository object that implements the interface
export const userRepository: UserRepository = { findById, findByUsername, findAll, create, update, delete: deleteUser, exists };
