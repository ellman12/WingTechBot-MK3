import { z } from "zod/v4";

// ============================================================================
// Common API Schemas
// ============================================================================

export const ApiSuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T): z.ZodObject<{ success: z.ZodLiteral<true>; data: T }> => z.object({ success: z.literal(true), data: dataSchema });

export const ApiErrorResponseSchema = z.object({ success: z.literal(false), error: z.string(), details: z.array(z.object({ path: z.string(), message: z.string() })).optional() });

export const ApiMessageResponseSchema = z.object({ success: z.literal(true), message: z.string() });

// ============================================================================
// Common API Types (derived from schemas)
// ============================================================================

export type ApiVersion = "v1";
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
export type ApiMessageResponse = z.infer<typeof ApiMessageResponseSchema>;

// Generic types that depend on other schemas
export type ApiSuccessResponse<T> = { readonly success: true; readonly data: T };

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
