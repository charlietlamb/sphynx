import { Schema } from "effect";

export const HealthResponseSchema = Schema.Struct({
  ok: Schema.Boolean,
});

export type HealthResponse = typeof HealthResponseSchema.Type;

export const ErrorResponseSchema = Schema.Struct({
  error: Schema.String,
});

export type ErrorResponse = typeof ErrorResponseSchema.Type;
