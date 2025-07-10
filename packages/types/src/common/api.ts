import { z } from 'zod';

// Base API response schema
export const ApiResponseSchema = z.object({
  success: z.boolean(),
});

// Success response with data
export const ApiSuccessResponseSchema = <T extends z.ZodType>(
  dataSchema: T
): z.ZodObject<{
  success: z.ZodLiteral<true>;
  data: T;
}> =>
  ApiResponseSchema.extend({
    success: z.literal(true),
    data: dataSchema,
  });

// Error response
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

// List response with pagination
export const ApiListResponseSchema = <T extends z.ZodType>(
  itemSchema: T
): z.ZodObject<{
  success: z.ZodLiteral<true>;
  data: z.ZodObject<{
    items: z.ZodArray<T>;
    total: z.ZodNumber;
    page: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodOptional<z.ZodNumber>;
  }>;
}> =>
  ApiSuccessResponseSchema(
    z.object({
      items: z.array(itemSchema),
      total: z.number(),
      page: z.number().optional(),
      limit: z.number().optional(),
    })
  );

// Delete response
export const ApiDeleteResponseSchema = ApiResponseSchema.extend({
  success: z.literal(true),
  message: z.string(),
});

// Health check response
export const HealthCheckResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
});

// Type inference
export type ApiResponse = z.infer<typeof ApiResponseSchema>;
export type ApiSuccessResponse<T> = ApiResponse & { success: true; data: T };
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
export type ApiListResponse<T> = ApiSuccessResponse<{
  items: T[];
  total: number;
  page?: number;
  limit?: number;
}>;
export type ApiDeleteResponse = z.infer<typeof ApiDeleteResponseSchema>;
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
