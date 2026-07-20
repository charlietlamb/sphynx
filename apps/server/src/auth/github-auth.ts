import { Auth } from "@sphynx/auth";
import { Database } from "@sphynx/db/client";
import { account, githubInstallation } from "@sphynx/db/schema";
import { Unauthorized } from "@sphynx/schema/pull-request-views";
import { InstallationRequired } from "@sphynx/schema/pull-requests";
import { and, eq } from "drizzle-orm";
import { Clock, Context, Effect, Layer } from "effect";
import { GitHubAppAuth, type Installation } from "../github/app-auth";
import { type GitHubCredential, userCredentialId } from "../github/credential";

const SIGN_IN = "Sign in to use Sphynx";
const INSTALL_REQUIRED =
  "Install the Sphynx GitHub App on an organization to continue";

interface SessionUser {
  readonly organizationId: string | null;
  readonly userId: string;
}

const makeGitHubAuth = Effect.gen(function* () {
  const auth = yield* Auth;
  const db = yield* Database;
  const app = yield* GitHubAppAuth;

  const sessionFor = (cookie: string | undefined) =>
    Effect.gen(function* () {
      const session = yield* Effect.tryPromise({
        try: () =>
          auth.api.getSession({
            headers: new Headers(cookie ? { cookie } : {}),
          }),
        catch: () => new Unauthorized({ message: SIGN_IN }),
      });
      if (!session) {
        return yield* Effect.fail(new Unauthorized({ message: SIGN_IN }));
      }
      return {
        userId: session.user.id,
        organizationId: session.session.activeOrganizationId ?? null,
      } satisfies SessionUser;
    });

  const userTokenFor = (userId: string) =>
    Effect.tryPromise(() =>
      db
        .select({ accessToken: account.accessToken })
        .from(account)
        .where(
          and(eq(account.userId, userId), eq(account.providerId, "github"))
        )
        .limit(1)
    ).pipe(
      Effect.tapErrorCause((cause) =>
        Effect.logError("github token lookup failed", cause)
      ),
      Effect.orDie,
      Effect.flatMap((rows) => {
        const token = rows[0]?.accessToken;
        return token
          ? Effect.succeed(token)
          : Effect.fail(new Unauthorized({ message: SIGN_IN }));
      }),
      Effect.annotateLogs({ "user.id": userId })
    );

  const rememberInstallations = (installations: readonly Installation[]) =>
    Effect.gen(function* () {
      if (installations.length === 0) {
        return;
      }
      const now = new Date(yield* Clock.currentTimeMillis);
      yield* Effect.tryPromise(() =>
        db
          .insert(githubInstallation)
          .values(
            installations.map((entry) => ({
              id: `gh_${entry.id}`,
              organizationId: null,
              installationId: entry.id,
              accountLogin: entry.account?.login ?? "unknown",
              accountType: entry.account?.type ?? "Organization",
              avatarUrl: entry.account?.avatar_url ?? null,
              repositorySelection: entry.repository_selection,
              createdAt: now,
              updatedAt: now,
            }))
          )
          .onConflictDoUpdate({
            target: githubInstallation.installationId,
            set: { updatedAt: now },
          })
      ).pipe(
        Effect.tapErrorCause((cause) =>
          Effect.logWarning("installation upsert failed", cause)
        ),
        Effect.ignore
      );
    });

  const linkedInstallationId = (organizationId: string) =>
    Effect.tryPromise(() =>
      db
        .select({ installationId: githubInstallation.installationId })
        .from(githubInstallation)
        .where(eq(githubInstallation.organizationId, organizationId))
        .limit(1)
    ).pipe(
      Effect.orDie,
      Effect.map((rows) => rows[0]?.installationId ?? null)
    );

  /** Installations the signed-in user can act through, freshest first. */
  const listInstallations = (cookie: string | undefined) =>
    sessionFor(cookie).pipe(
      Effect.flatMap((session) => userTokenFor(session.userId)),
      Effect.flatMap(app.listUserInstallations),
      Effect.tap(rememberInstallations),
      Effect.withSpan("GitHubAuth.listInstallations")
    );

  /** Installation ids the user is known to reach, without calling GitHub. */
  const knownInstallationIds = (userId: string) =>
    Effect.tryPromise(() =>
      db
        .select({ installationId: githubInstallation.installationId })
        .from(githubInstallation)
    ).pipe(
      Effect.orDie,
      Effect.map((rows) => new Set(rows.map((row) => row.installationId))),
      Effect.annotateLogs({ "user.id": userId })
    );

  /**
   * Resolves which installation a read should run through, in order of
   * specificity: the one the client asked for, the one linked to the active
   * organization, then the user's first.
   *
   * Only the fallback calls GitHub, so steady-state reads cost no extra
   * round-trip.
   */
  const resolveInstallationId = (
    cookie: string | undefined,
    session: SessionUser,
    requested: number | null
  ) =>
    Effect.gen(function* () {
      if (requested !== null) {
        const known = yield* knownInstallationIds(session.userId);
        if (known.has(requested)) {
          return requested;
        }
      }
      const linked = session.organizationId
        ? yield* linkedInstallationId(session.organizationId)
        : null;
      if (linked !== null) {
        return linked;
      }
      const installations = yield* listInstallations(cookie).pipe(
        Effect.catchAll(() => Effect.succeed<readonly Installation[]>([]))
      );
      const first = installations[0];
      if (!first) {
        return yield* Effect.fail(
          new InstallationRequired({ message: INSTALL_REQUIRED })
        );
      }
      return first.id;
    });

  /**
   * Reads run as the installation so they draw on the app's own rate-limit
   * budget rather than the signed-in user's personal 5,000/hr.
   */
  const readCredential = (
    cookie: string | undefined,
    requested: number | null = null
  ) =>
    sessionFor(cookie).pipe(
      Effect.flatMap((session) =>
        resolveInstallationId(cookie, session, requested)
      ),
      Effect.map(app.installationCredential),
      Effect.withSpan("GitHubAuth.readCredential")
    );

  /**
   * Writes run as the signed-in human so GitHub attributes merges, reviews and
   * comments to them rather than to the app.
   */
  const writeCredential = (
    cookie: string | undefined
  ): Effect.Effect<GitHubCredential, Unauthorized> =>
    sessionFor(cookie).pipe(
      Effect.map((session) => ({
        kind: "user" as const,
        id: userCredentialId(session.userId),
        token: userTokenFor(session.userId),
      })),
      Effect.withSpan("GitHubAuth.writeCredential")
    );

  /** Most handlers just need a bearer token, not the credential envelope. */
  const readToken = (
    cookie: string | undefined,
    requested: number | null = null
  ) => readCredential(cookie, requested).pipe(Effect.flatMap((it) => it.token));

  const writeToken = (cookie: string | undefined) =>
    writeCredential(cookie).pipe(Effect.flatMap((it) => it.token));

  return {
    listInstallations,
    readCredential,
    readToken,
    writeCredential,
    writeToken,
  };
});

export class GitHubAuth extends Context.Tag("@sphynx/server/GitHubAuth")<
  GitHubAuth,
  Effect.Effect.Success<typeof makeGitHubAuth>
>() {}

export const GitHubAuthLive = Layer.effect(GitHubAuth, makeGitHubAuth);
