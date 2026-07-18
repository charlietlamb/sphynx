import { Schema } from "effect";

export const OkSchema = Schema.Struct({ ok: Schema.Boolean });

export const cookieHeaders = Schema.Struct({
  cookie: Schema.optional(Schema.String),
});
