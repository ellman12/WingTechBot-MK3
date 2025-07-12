import type { CreateUserData, UpdateUserData, User } from "@core/entities/User.js";
import type { UserRepository } from "@core/repositories/UserRepository.js";
import type { Kysely, Selectable } from "kysely";
import type { DB, Users } from "kysely-codegen";

// Private state using file-level constants
let dbInstance: Kysely<DB> | null = null;

// Private functions
const getDatabase = (): Kysely<DB> => {
    if (!dbInstance) {
        throw new Error("UserRepository not initialized. Call initializeUserRepository first.");
    }
    return dbInstance;
};

// Transform database user to domain user
const transformUser = (dbUser: Selectable<Users>): User => {
    return { id: dbUser.id, username: dbUser.username, displayName: dbUser.display_name ?? undefined, avatar: dbUser.avatar ?? undefined, isBot: dbUser.is_bot, createdAt: dbUser.created_at, updatedAt: dbUser.updated_at } satisfies User;
};

// Public interface - exported functions
export const initializeUserRepository = (db: Kysely<DB>): void => {
    dbInstance = db;
};

export const findUserById = async (id: string): Promise<User | null> => {
    const db = getDatabase();

    const user = await db.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirst();

    return user ? transformUser(user) : null;
};

export const getUserByUsername = async (username: string): Promise<User | null> => {
    const db = getDatabase();

    const user = await db.selectFrom("users").selectAll().where("username", "=", username).executeTakeFirst();

    return user ? transformUser(user) : null;
};

export const getAllUsers = async (): Promise<User[]> => {
    const db = getDatabase();

    const users = await db.selectFrom("users").selectAll().execute();

    return users.map(transformUser);
};

export const createUser = async (data: CreateUserData): Promise<User> => {
    const db = getDatabase();

    const [user] = await db
        .insertInto("users")
        .values({ id: data.id, username: data.username, display_name: data.displayName ?? null, avatar: data.avatar ?? null, is_bot: data.isBot ?? false, created_at: new Date(), updated_at: new Date() })
        .returningAll()
        .execute();

    if (!user) {
        throw new Error("Failed to create user");
    }

    return transformUser(user);
};

export const updateUser = async (id: string, data: UpdateUserData): Promise<User | null> => {
    const db = getDatabase();

    const updateData: Record<string, unknown> = { updated_at: new Date() };

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
        updateData.is_bot = data.isBot;
    }

    const [user] = await db.updateTable("users").set(updateData).where("id", "=", id).returningAll().execute();

    return user ? transformUser(user) : null;
};

export const deleteUser = async (id: string): Promise<boolean> => {
    const db = getDatabase();

    const result = await db.deleteFrom("users").where("id", "=", id).execute();

    return result.length > 0;
};

export const userExists = async (id: string): Promise<boolean> => {
    const db = getDatabase();

    const user = await db.selectFrom("users").select("id").where("id", "=", id).executeTakeFirst();

    return !!user;
};

// Export the repository object that implements the interface
export const userRepository: UserRepository = { findById: findUserById, findByUsername: getUserByUsername, findAll: getAllUsers, create: createUser, update: updateUser, delete: deleteUser, exists: userExists };
