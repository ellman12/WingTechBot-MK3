import { z } from 'zod';

// ============================================================================
// Guild API Schemas
// ============================================================================

export const CreateGuildRequestSchema = z.object({
  id: z.string().min(1, 'Guild ID is required'),
  name: z.string().min(1, 'Guild name is required'),
  ownerId: z.string().min(1, 'Guild owner ID is required'),
  memberCount: z.number().int().min(0).optional(),
  prefix: z.string().max(5).regex(/^\S+$/).optional(),
});

export const UpdateGuildRequestSchema = z.object({
  name: z.string().min(1).optional(),
  memberCount: z.number().int().min(0).optional(),
  prefix: z.string().max(5).regex(/^\S+$/).optional(),
  isActive: z.boolean().optional(),
});

export const GuildParamsSchema = z.object({
  id: z.string().min(1, 'Guild ID is required'),
});

export const ApiGuildSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  ownerId: z.string().min(1),
  memberCount: z.number().int().min(0),
  prefix: z.string().max(5),
  isActive: z.boolean(),
  createdAt: z.string(), // ISO string for API
  updatedAt: z.string(), // ISO string for API
});

// ============================================================================
// Guild API Types (derived from schemas)
// ============================================================================

export type CreateGuildRequest = z.infer<typeof CreateGuildRequestSchema>;
export type UpdateGuildRequest = z.infer<typeof UpdateGuildRequestSchema>;
export type GuildParams = z.infer<typeof GuildParamsSchema>;
export type ApiGuild = z.infer<typeof ApiGuildSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

export const validateCreateGuildRequest = (data: unknown): CreateGuildRequest =>
  CreateGuildRequestSchema.parse(data);

export const validateUpdateGuildRequest = (data: unknown): UpdateGuildRequest =>
  UpdateGuildRequestSchema.parse(data);

export const validateGuildParams = (data: unknown): GuildParams => GuildParamsSchema.parse(data);
