// ============================================================================
// User API v1 Contracts - Types Package
// ============================================================================
import { z } from "zod";

// API Request DTOs
export const CreateUserRequestSchema = z.object({
    id: z.string().min(1, "User ID is required"),
    username: z.string().min(1, "Username is required"),
    displayName: z.string().optional(),
    avatar: z.string().optional(),
    isBot: z.boolean().default(false),
});

export const UpdateUserRequestSchema = z.object({ username: z.string().min(1, "Username is required").optional(), displayName: z.string().optional(), avatar: z.string().optional(), isBot: z.boolean().optional() });

// API Response DTOs
export const UserResponseSchema = z.object({
    id: z.string(),
    username: z.string(),
    displayName: z.string().optional(),
    avatar: z.string().optional(),
    isBot: z.boolean(),
    createdAt: z.string(), // ISO date string
    updatedAt: z.string(), // ISO date string
});

export const UsersResponseSchema = z.object({ success: z.literal(true), data: z.array(UserResponseSchema) });

export const SingleUserResponseSchema = z.object({ success: z.literal(true), data: UserResponseSchema });

// Type inference
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;
export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
export type UsersResponse = z.infer<typeof UsersResponseSchema>;
export type SingleUserResponse = z.infer<typeof SingleUserResponseSchema>;

// Transformation functions (Domain → API)
export const userToResponse = (user: { id: string; username: string; displayName?: string; avatar?: string; isBot: boolean; createdAt: Date; updatedAt: Date }): UserResponse => ({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar,
    isBot: user.isBot,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
});

export const usersToResponse = (users: Array<{ id: string; username: string; displayName?: string; avatar?: string; isBot: boolean; createdAt: Date; updatedAt: Date }>): UsersResponse => ({ success: true, data: users.map(userToResponse) });

export const singleUserToResponse = (user: { id: string; username: string; displayName?: string; avatar?: string; isBot: boolean; createdAt: Date; updatedAt: Date }): SingleUserResponse => ({ success: true, data: userToResponse(user) });

// Validation functions
export const validateCreateUserRequest = (data: unknown): CreateUserRequest => CreateUserRequestSchema.parse(data);

export const validateUpdateUserRequest = (data: unknown): UpdateUserRequest => UpdateUserRequestSchema.parse(data);
