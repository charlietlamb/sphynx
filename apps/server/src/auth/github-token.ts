import type { Auth } from "@sphynx/auth";
import type { Database } from "@sphynx/db/client";
import { account } from "@sphynx/db/schema";
import { Unauthorized } from "@sphynx/schema/pull-requests";
import { and, eq } from "drizzle-orm";
import { type Context, Effect } from "effect";

type AuthService = Context.Tag.Service<typeof Auth>;
type DatabaseService = Context.Tag.Service<typeof Database>;

export const githubTokenFor =
  (auth: AuthService, db: DatabaseService, message: string) =>
  (cookie: string | undefined) =>
    Effect.gen(function* () {
      const session = yield* Effect.tryPromise({
        try: () =>
          auth.api.getSession({
            headers: new Headers(cookie ? { cookie } : {}),
          }),
        catch: () => new Unauthorized({ message }),
      });
      if (!session) {
        return yield* Effect.fail(new Unauthorized({ message }));
      }
      const rows = yield* Effect.tryPromise(() =>
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
      ).pipe(
        Effect.tapErrorCause((cause) =>
          Effect.logError("github token lookup failed", cause)
        ),
        Effect.orDie,
        Effect.annotateLogs({ "user.id": session.user.id })
      );
      const token = rows[0]?.accessToken;
      if (!token) {
        return yield* Effect.fail(new Unauthorized({ message }));
      }
      return token;
    }).pipe(Effect.withSpan("githubTokenFor"));
