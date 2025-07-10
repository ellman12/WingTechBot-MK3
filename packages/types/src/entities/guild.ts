import { z } from 'zod';

// Guild entity schema
export const GuildSchema = z.object({
  id: z.string().min(1, 'Guild ID is required'),
  name: z.string().min(1, 'Guild name is required'),
  ownerId: z.string().min(1, 'Guild owner ID is required'),
  memberCount: z.number().int().min(0, 'Member count must be non-negative'),
  prefix: z
    .string()
    .max(5, 'Guild prefix cannot be longer than 5 characters')
    .regex(/^\S+$/, 'Guild prefix cannot contain spaces'),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Create guild data schema (without id, createdAt, updatedAt)
export const CreateGuildDataSchema = z.object({
  id: z.string().min(1, 'Guild ID is required'),
  name: z.string().min(1, 'Guild name is required'),
  ownerId: z.string().min(1, 'Guild owner ID is required'),
  memberCount: z.number().int().min(0, 'Member count must be non-negative').default(0),
  prefix: z
    .string()
    .max(5, 'Guild prefix cannot be longer than 5 characters')
    .regex(/^\S+$/, 'Guild prefix cannot contain spaces')
    .default('!'),
  isActive: z.boolean().default(true),
});

// Update guild data schema (all fields optional except constraints)
export const UpdateGuildDataSchema = z.object({
  name: z.string().min(1, 'Guild name is required').optional(),
  ownerId: z.string().min(1, 'Guild owner ID is required').optional(),
  memberCount: z.number().int().min(0, 'Member count must be non-negative').optional(),
  prefix: z
    .string()
    .max(5, 'Guild prefix cannot be longer than 5 characters')
    .regex(/^\S+$/, 'Guild prefix cannot contain spaces')
    .optional(),
  isActive: z.boolean().optional(),
});

// Type inference
export type Guild = z.infer<typeof GuildSchema>;
export type CreateGuildData = z.infer<typeof CreateGuildDataSchema>;
export type UpdateGuildData = z.infer<typeof UpdateGuildDataSchema>;

// Validation functions
export const validateGuild = (data: unknown): Guild => GuildSchema.parse(data);
export const validateCreateGuildData = (data: unknown): CreateGuildData =>
  CreateGuildDataSchema.parse(data);
export const validateUpdateGuildData = (data: unknown): UpdateGuildData =>
  UpdateGuildDataSchema.parse(data);
