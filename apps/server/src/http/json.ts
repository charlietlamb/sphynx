import { Schema } from "effect";

export const json = <A, I>(
  schema: Schema.Schema<A, I, never>,
  value: A,
  init?: ResponseInit
) => Response.json(Schema.encodeSync(schema)(value), init);
