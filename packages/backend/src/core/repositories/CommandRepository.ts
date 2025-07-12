import type { Command, CreateCommandData, UpdateCommandData } from "../entities/Command.js";

export interface CommandRepository {
    findById(id: string): Promise<Command | null>;
    findByUserId(userId: string): Promise<Command[]>;
    findByName(name: string): Promise<Command[]>;
    findAll(): Promise<Command[]>;
    create(data: CreateCommandData): Promise<Command>;
    update(id: string, data: UpdateCommandData): Promise<Command | null>;
    delete(id: string): Promise<boolean>;
    exists(id: string): Promise<boolean>;
}
