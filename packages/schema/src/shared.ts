import { Schema } from "effect";

export const OkSchema = Schema.Struct({ ok: Schema.Boolean });

export const cookieHeaders = Schema.Struct({
  cookie: Schema.optional(Schema.String),
});

/**
 * Reads are scoped to one GitHub App installation. The client names the one it
 * wants; the server validates the user can reach it before minting a token.
 */
export const installationHeaders = Schema.Struct({
  cookie: Schema.optional(Schema.String),
  "x-sphynx-installation": Schema.optional(Schema.String),
});
