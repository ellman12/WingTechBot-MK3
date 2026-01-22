import type { CreateUserData, UpdateUserData, User } from "../entities/User.js";

export type UserRepository = {
    readonly findById: (id: string) => Promise<User | undefined>;
    readonly findByIds: (ids: string[]) => Promise<User[]>;
    readonly findByUsername: (username: string) => Promise<User | undefined>;
    readonly getAll: () => Promise<User[]>;
    readonly create: (data: CreateUserData) => Promise<User>;
    readonly createMany: (data: CreateUserData[]) => Promise<User[]>;
    readonly update: (id: string, data: UpdateUserData) => Promise<User | undefined>;
};
