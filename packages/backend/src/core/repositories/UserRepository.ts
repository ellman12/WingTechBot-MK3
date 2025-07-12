import type { CreateUserData, UpdateUserData, User } from "../entities/User.js";

export interface UserRepository {
    findById(id: string): Promise<User | null>;
    findByUsername(username: string): Promise<User | null>;
    findAll(): Promise<User[]>;
    create(data: CreateUserData): Promise<User>;
    update(id: string, data: UpdateUserData): Promise<User | null>;
    delete(id: string): Promise<boolean>;
    exists(id: string): Promise<boolean>;
}
