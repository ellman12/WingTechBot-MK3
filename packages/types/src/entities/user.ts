import { z } from 'zod';

// User entity schema
export const UserSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
  username: z.string().min(1, 'Username is required'),
  displayName: z.string().optional(),
  avatar: z.string().optional(),
  isBot: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Create user data schema
export const CreateUserDataSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
  username: z.string().min(1, 'Username is required'),
  displayName: z.string().optional(),
  avatar: z.string().optional(),
  isBot: z.boolean().default(false),
});

// Update user data schema
export const UpdateUserDataSchema = z.object({
  username: z.string().min(1, 'Username is required').optional(),
  displayName: z.string().optional(),
  avatar: z.string().optional(),
  isBot: z.boolean().optional(),
});

// Type inference
export type User = z.infer<typeof UserSchema>;
export type CreateUserData = z.infer<typeof CreateUserDataSchema>;
export type UpdateUserData = z.infer<typeof UpdateUserDataSchema>;

// Validation functions
export const validateUser = (data: unknown): User => UserSchema.parse(data);
export const validateCreateUserData = (data: unknown): CreateUserData =>
  CreateUserDataSchema.parse(data);
export const validateUpdateUserData = (data: unknown): UpdateUserData =>
  UpdateUserDataSchema.parse(data);
