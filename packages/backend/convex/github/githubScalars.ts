import { Schema } from "effect";

/**
 * GitHub's `fullDatabaseId` is a `BigInt` scalar that serializes as a JSON
 * number, yet the read model stores comment ids as strings. Decoding it here as
 * number-or-string and transforming to a string at the boundary means every
 * consumer receives a clean `string | null` and no numeric id can ever reach the
 * store — the single place this coercion lives.
 */
export const FullDatabaseId = Schema.transform(
  Schema.NullishOr(Schema.Union(Schema.String, Schema.Number)),
  Schema.NullOr(Schema.String),
  {
    strict: true,
    decode: (value) => (value == null ? null : String(value)),
    encode: (value) => value,
  }
);
