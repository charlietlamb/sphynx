import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Context, Effect, Layer, Redacted } from "effect";
import { Pool } from "pg";
import { DatabaseConfig } from "./config";
import { schema } from "./schema";

export class Database extends Context.Tag("@sphynx/db/Database")<
  Database,
  NodePgDatabase<typeof schema>
>() {}

export const DatabaseLive = Layer.scoped(
  Database,
  Effect.gen(function* () {
    const config = yield* DatabaseConfig;
    const pool = yield* Effect.acquireRelease(
      Effect.sync(
        () => new Pool({ connectionString: Redacted.value(config.url) })
      ),
      (pool) => Effect.promise(() => pool.end()).pipe(Effect.orDie)
    );

    return drizzle(pool, { schema });
  })
);
