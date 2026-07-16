import type { Auth } from "@sphynx/auth";
import type { Database } from "@sphynx/db/client";
import { account } from "@sphynx/db/schema";
import { Unauthorized } from "@sphynx/schema/pull-request-views";
import { and, eq } from "drizzle-orm";
import { type Context, Effect } from "effect";

type AuthService = Context.Tag.Service<typeof Auth>;
type DatabaseService = Context.Tag.Service<typeof Database>;

export const githubTokenFor =
  (auth: AuthService, db: DatabaseService, message: string) =>
  (cookie: string | undefined) =>
    Effect.gen(function* () {
      const session = yield* Effect.promise(() =>
        auth.api.getSession({
          headers: new Headers(cookie ? { cookie } : {}),
        })
      );
      if (!session) {
        return yield* Effect.fail(new Unauthorized({ message }));
      }
      const rows = yield* Effect.promise(() =>
        db
          .select({ accessToken: account.accessToken })
          .from(account)
          .where(
            and(
              eq(account.userId, session.user.id),
              eq(account.providerId, "github")
            )
          )
          .limit(1)
      );
      const token = rows[0]?.accessToken;
      if (!token) {
        return yield* Effect.fail(new Unauthorized({ message }));
      }
      return token;
    });
