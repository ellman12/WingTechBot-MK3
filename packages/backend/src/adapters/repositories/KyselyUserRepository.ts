import type { CreateUserData, UpdateUserData, User } from "@core/entities/User.js";
import type { UserRepository } from "@core/repositories/UserRepository.js";
import type { DB, Users } from "@db/types.js";
import type { Kysely, Selectable } from "kysely";

// Transform database user to domain user
const transformUser = (dbUser: Selectable<Users>): User => {
    return {
        id: dbUser.id,
        username: dbUser.username,
        displayName: dbUser.display_name ?? undefined,
        avatar: dbUser.avatar ?? undefined,
        isBot: dbUser.is_bot,
    } satisfies User;
};

// Factory function to create UserRepository instance
export const createUserRepository = (db: Kysely<DB>): UserRepository => {
    const findUserById = async (id: string): Promise<User | null> => {
        const user = await db.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirst();
        return user ? transformUser(user) : null;
    };

    const getUserByUsername = async (username: string): Promise<User | null> => {
        const user = await db.selectFrom("users").selectAll().where("username", "=", username).executeTakeFirst();
        return user ? transformUser(user) : null;
    };

    const getAllUsers = async (): Promise<User[]> => {
        const users = await db.selectFrom("users").selectAll().execute();
        return users.map(transformUser);
    };

    const createUser = async (data: CreateUserData): Promise<User> => {
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

    const updateUser = async (id: string, data: UpdateUserData): Promise<User | null> => {
        const updateData: Record<string, unknown> = { updated_at: new Date() };

        if (data.username !== undefined) {
            updateData.username = data.username;
        }
        if (data.displayName !== undefined) {
            updateData.display_name = data.displayName;
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

    const deleteUser = async (id: string): Promise<boolean> => {
        const result = await db.deleteFrom("users").where("id", "=", id).execute();
        return result.length > 0;
    };

    const userExists = async (id: string): Promise<boolean> => {
        const user = await db.selectFrom("users").select("id").where("id", "=", id).executeTakeFirst();
        return !!user;
    };

    return {
        findById: findUserById,
        findByUsername: getUserByUsername,
        findAll: getAllUsers,
        create: createUser,
        update: updateUser,
        delete: deleteUser,
        exists: userExists,
    };
};
