import type { CreateUserData, UpdateUserData, User } from "../entities/User.js";

export type UserRepository = {
    readonly findById: (id: string) => Promise<User | null>;
    readonly findByUsername: (username: string) => Promise<User | null>;
    readonly findAll: () => Promise<User[]>;
    readonly create: (data: CreateUserData) => Promise<User>;
    readonly update: (id: string, data: UpdateUserData) => Promise<User | null>;
    readonly delete: (id: string) => Promise<boolean>;
    readonly exists: (id: string) => Promise<boolean>;
};
