import type { CreateUserData, UpdateUserData, User } from '@wingtechbot-mk3/types/entities/user';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findAll(): Promise<User[]>;
  create(data: CreateUserData): Promise<User>;
  update(id: string, data: UpdateUserData): Promise<User | null>;
  delete(id: string): Promise<boolean>;
  exists(id: string): Promise<boolean>;
}
