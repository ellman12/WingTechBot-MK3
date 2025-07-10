import type {
  CreateGuildData,
  Guild,
  UpdateGuildData,
} from '@wingtechbot-mk3/types/entities/guild';

export interface GuildRepository {
  readonly findById: (id: string) => Promise<Guild | null>;
  readonly findAll: () => Promise<Guild[]>;
  readonly findByOwnerId: (ownerId: string) => Promise<Guild[]>;
  readonly create: (data: CreateGuildData) => Promise<Guild>;
  readonly update: (id: string, data: UpdateGuildData) => Promise<Guild | null>;
  readonly delete: (id: string) => Promise<boolean>;
  readonly exists: (id: string) => Promise<boolean>;
}

export type FindGuildById = (id: string) => Promise<Guild | null>;
export type FindAllGuilds = () => Promise<Guild[]>;
export type FindGuildsByOwnerId = (ownerId: string) => Promise<Guild[]>;
export type CreateGuild = (data: CreateGuildData) => Promise<Guild>;
export type UpdateGuild = (id: string, data: UpdateGuildData) => Promise<Guild | null>;
export type DeleteGuild = (id: string) => Promise<boolean>;
export type GuildExists = (id: string) => Promise<boolean>;
