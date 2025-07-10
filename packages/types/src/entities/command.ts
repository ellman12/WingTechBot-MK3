import { z } from 'zod';

// Command entity schema
export const CommandSchema = z.object({
  id: z.string().min(1, 'Command ID is required'),
  name: z.string().min(1, 'Command name is required'),
  description: z.string().optional(),
  guildId: z.string().optional(),
  userId: z.string().min(1, 'User ID is required'),
  arguments: z.string().optional(),
  executedAt: z.coerce.date(),
  success: z.boolean(),
  error: z.string().optional(),
});

// Create command data schema
export const CreateCommandDataSchema = z.object({
  name: z.string().min(1, 'Command name is required'),
  description: z.string().optional(),
  guildId: z.string().optional(),
  userId: z.string().min(1, 'User ID is required'),
  arguments: z.string().optional(),
  success: z.boolean(),
  error: z.string().optional(),
});

// Type inference
export type Command = z.infer<typeof CommandSchema>;
export type CreateCommandData = z.infer<typeof CreateCommandDataSchema>;

// Validation functions
export const validateCommand = (data: unknown): Command => CommandSchema.parse(data);
export const validateCreateCommandData = (data: unknown): CreateCommandData =>
  CreateCommandDataSchema.parse(data);
