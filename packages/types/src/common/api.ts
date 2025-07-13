import { z } from "zod/v4";

// ============================================================================
// Common API Schemas
// ============================================================================

export const ApiResponseSchema = z.object({ success: z.boolean() });

export const ApiSuccessResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
    ApiResponseSchema.extend({
        success: z.literal(true),
        data: dataSchema,
    });

export const ApiErrorResponseSchema = ApiResponseSchema.extend({
    success: z.literal(false),
    error: z.string(),
    details: z
        .array(
            z.object({
                path: z.string(),
                message: z.string(),
            })
        )
        .optional(),
});

export const ApiListResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
    ApiSuccessResponseSchema(
        z.object({
            items: z.array(itemSchema),
            total: z.number(),
            page: z.number().optional(),
            limit: z.number().optional(),
        })
    );

export const ApiDeleteResponseSchema = ApiResponseSchema.extend({
    success: z.literal(true),
    message: z.string(),
});

export const HealthCheckResponseSchema = z.object({
    status: z.literal("ok"),
    timestamp: z.string(),
    version: z.literal("v1"),
});

// ============================================================================
// Common API Types (derived from schemas)
// ============================================================================

export type ApiResponse = z.infer<typeof ApiResponseSchema>;
export type ApiSuccessResponse<T extends z.ZodType> = z.infer<ReturnType<typeof ApiSuccessResponseSchema<T>>>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
export type ApiListResponse<T extends z.ZodType> = z.infer<ReturnType<typeof ApiListResponseSchema<T>>>;
export type ApiDeleteResponse = z.infer<typeof ApiDeleteResponseSchema>;
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
export type ApiVersion = "v1";
export type ApiResponseUnion<T extends z.ZodType> = ApiSuccessResponse<T> | ApiErrorResponse;
