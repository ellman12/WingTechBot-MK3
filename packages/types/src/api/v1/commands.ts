// ============================================================================
// Command API v1 Contracts - Types Package
// ============================================================================
import { z } from "zod";

// API Request DTOs
export const CreateCommandRequestSchema = z.object({
    name: z.string().min(1, "Command name is required"),
    description: z.string().optional(),
    userId: z.string().min(1, "User ID is required"),
    arguments: z.string().optional(),
    success: z.boolean(),
    error: z.string().optional(),
});

export const UpdateCommandRequestSchema = z.object({
    name: z.string().min(1, "Command name is required").optional(),
    description: z.string().optional(),
    userId: z.string().min(1, "User ID is required").optional(),
    arguments: z.string().optional(),
    success: z.boolean().optional(),
    error: z.string().optional(),
});

// API Response DTOs
export const CommandResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    userId: z.string(),
    arguments: z.string().optional(),
    executedAt: z.string(), // ISO date string
    success: z.boolean(),
    error: z.string().optional(),
});

export const CommandsResponseSchema = z.object({ success: z.literal(true), data: z.array(CommandResponseSchema) });

export const SingleCommandResponseSchema = z.object({ success: z.literal(true), data: CommandResponseSchema });

// Type inference
export type CreateCommandRequest = z.infer<typeof CreateCommandRequestSchema>;
export type UpdateCommandRequest = z.infer<typeof UpdateCommandRequestSchema>;
export type CommandResponse = z.infer<typeof CommandResponseSchema>;
export type CommandsResponse = z.infer<typeof CommandsResponseSchema>;
export type SingleCommandResponse = z.infer<typeof SingleCommandResponseSchema>;

// Transformation functions (Domain → API)
export const commandToResponse = (command: { id: string; name: string; description?: string; userId: string; arguments?: string; executedAt: Date; success: boolean; error?: string }): CommandResponse => ({
    id: command.id,
    name: command.name,
    description: command.description,
    userId: command.userId,
    arguments: command.arguments,
    executedAt: command.executedAt.toISOString(),
    success: command.success,
    error: command.error,
});

export const commandsToResponse = (commands: Array<{ id: string; name: string; description?: string; userId: string; arguments?: string; executedAt: Date; success: boolean; error?: string }>): CommandsResponse => ({
    success: true,
    data: commands.map(commandToResponse),
});

export const singleCommandToResponse = (command: { id: string; name: string; description?: string; userId: string; arguments?: string; executedAt: Date; success: boolean; error?: string }): SingleCommandResponse => ({
    success: true,
    data: commandToResponse(command),
});

// Validation functions
export const validateCreateCommandRequest = (data: unknown): CreateCommandRequest => CreateCommandRequestSchema.parse(data);

export const validateUpdateCommandRequest = (data: unknown): UpdateCommandRequest => UpdateCommandRequestSchema.parse(data);
