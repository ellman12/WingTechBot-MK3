import { z } from 'zod';

// ============================================================================
// Health API Schemas
// ============================================================================

export const HealthCheckResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
  version: z.literal('v1'),
});

// ============================================================================
// Health API Types (derived from schemas)
// ============================================================================

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
