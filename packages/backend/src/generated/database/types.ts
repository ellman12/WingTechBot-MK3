import type { ColumnType } from 'kysely';

export type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type Command = {
  id: string;
  name: string;
  description: string | null;
  guildId: string | null;
  userId: string;
  arguments: string | null;
  executedAt: Generated<Timestamp>;
  success: boolean;
  error: string | null;
};
export type Guild = {
  id: string;
  name: string;
  ownerId: string;
  memberCount: Generated<number>;
  prefix: Generated<string>;
  isActive: Generated<boolean>;
  createdAt: Generated<Timestamp>;
  updatedAt: Timestamp;
};
export type GuildMember = {
  id: string;
  userId: string;
  guildId: string;
  nickname: string | null;
  joinedAt: Generated<Timestamp>;
  roles: Generated<string>;
  isActive: Generated<boolean>;
};
export type GuildSettings = {
  id: string;
  guildId: string;
  welcomeChannel: string | null;
  logChannel: string | null;
  modRole: string | null;
  adminRole: string | null;
  autoRole: string | null;
  welcomeMessage: string | null;
  leaveMessage: string | null;
  enabledFeatures: Generated<string>;
  createdAt: Generated<Timestamp>;
  updatedAt: Timestamp;
};
export type User = {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  isBot: Generated<boolean>;
  createdAt: Generated<Timestamp>;
  updatedAt: Timestamp;
};
export type DB = {
  commands: Command;
  guild_members: GuildMember;
  guild_settings: GuildSettings;
  guilds: Guild;
  users: User;
};
