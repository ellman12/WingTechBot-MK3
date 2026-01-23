import type { CreateUserData, UpdateUserData, User } from "@core/entities/User.js";
import type { UserRepository } from "@core/repositories/UserRepository.js";
import type { DB, Users } from "@db/types.js";
import type { Kysely, Selectable } from "kysely";

const transformUser = (dbUser: Selectable<Users>): User => {
    return {
        id: dbUser.id,
        username: dbUser.username,
        isBot: dbUser.is_bot,
        createdAt: dbUser.created_at,
        joinedAt: dbUser.joined_at,
    };
};

export const createUserRepository = (db: Kysely<DB>): UserRepository => {
    const findUserById = async (id: string): Promise<User | undefined> => {
        const user = await db.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirst();
        return user ? transformUser(user) : undefined;
    };

    const findUsersByIds = async (ids: string[]): Promise<User[]> => {
        if (ids.length === 0) return [];

        const users = await db.selectFrom("users").selectAll().where("id", "in", ids).execute();
        return users.map(transformUser);
    };

    const getUserByUsername = async (username: string): Promise<User | undefined> => {
        const user = await db.selectFrom("users").selectAll().where("username", "=", username).executeTakeFirst();
        return user ? transformUser(user) : undefined;
    };

    const getAllUsers = async (): Promise<User[]> => {
        const users = await db.selectFrom("users").selectAll().execute();
        return users.map(transformUser);
    };

    const createUser = async (data: CreateUserData): Promise<User> => {
        const { id, username, createdAt, joinedAt } = data;

        const user = await db.insertInto("users").values({ id, username, created_at: createdAt, joined_at: joinedAt }).returningAll().executeTakeFirst();

        if (!user) throw new Error("Failed to create user");
        return transformUser(user);
    };

    const createUsers = async (data: CreateUserData[]): Promise<User[]> => {
        if (data.length === 0) return [];

        const rows = data.map(({ id, username, createdAt, joinedAt, isBot }) => ({
            id,
            username,
            is_bot: isBot,
            created_at: createdAt,
            joined_at: joinedAt,
        }));

        const users = await db.insertInto("users").values(rows).returningAll().execute();
        return users.map(transformUser);
    };

    const updateUser = async (id: string, data: UpdateUserData): Promise<User | undefined> => {
        const dbData: Record<string, unknown> = {};

        if ("username" in data) dbData.username = data.username;
        if ("joinedAt" in data) dbData.joined_at = data.joinedAt;

        const user = await db.updateTable("users").set(dbData).where("id", "=", id).returningAll().executeTakeFirst();
        return user ? transformUser(user) : undefined;
    };

    return {
        findById: findUserById,
        findByIds: findUsersByIds,
        findByUsername: getUserByUsername,
        getAll: getAllUsers,
        create: createUser,
        createMany: createUsers,
        update: updateUser,
    };
};
