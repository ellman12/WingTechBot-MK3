import { z } from "zod/v4";

// Guild member entity schema
export const GuildMemberSchema = z.object({
    id: z.string().min(1, "Guild member ID is required"),
    userId: z.string().min(1, "User ID is required"),
    guildId: z.string().min(1, "Guild ID is required"),
    nickname: z.string().optional(),
    joinedAt: z.coerce.date(),
    roles: z.array(z.string()).default([]),
    isActive: z.boolean(),
});

// Create guild member data schema
export const CreateGuildMemberDataSchema = z.object({
    userId: z.string().min(1, "User ID is required"),
    guildId: z.string().min(1, "Guild ID is required"),
    nickname: z.string().optional(),
    roles: z.array(z.string()).default([]),
    isActive: z.boolean().default(true),
});

// Update guild member data schema
export const UpdateGuildMemberDataSchema = z.object({ nickname: z.string().optional(), roles: z.array(z.string()).optional(), isActive: z.boolean().optional() });

// Type inference
export type GuildMember = z.infer<typeof GuildMemberSchema>;
export type CreateGuildMemberData = z.infer<typeof CreateGuildMemberDataSchema>;
export type UpdateGuildMemberData = z.infer<typeof UpdateGuildMemberDataSchema>;

// Validation functions
export const validateGuildMember = (data: unknown): GuildMember => GuildMemberSchema.parse(data);
export const validateCreateGuildMemberData = (data: unknown): CreateGuildMemberData => CreateGuildMemberDataSchema.parse(data);
export const validateUpdateGuildMemberData = (data: unknown): UpdateGuildMemberData => UpdateGuildMemberDataSchema.parse(data);
