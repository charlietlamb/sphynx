import { Auth } from "@sphynx/auth";
import { Database } from "@sphynx/db/client";
import { githubInstallation } from "@sphynx/db/schema";
import {
  InstallationRequired,
  Unauthorized,
} from "@sphynx/schema/pull-requests";
import { eq } from "drizzle-orm";
import { Clock, Context, Effect, Layer } from "effect";
import { GitHubAppAuth, type Installation } from "../github/app-auth";
import { type GitHubCredential, userCredentialId } from "../github/credential";

const SIGN_IN = "Sign in to use Sphynx";
/**
 * Distinct from SIGN_IN: the session is valid, but no GitHub token is stored
 * for the user. Writes act as the human, so they cannot fall back to the app.
 * Sharing one message here made every 401 indistinguishable in production.
 */
const RECONNECT_GITHUB = "Reconnect GitHub to act on pull requests";
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
        return yield* Effect.logInfo("no session on request").pipe(
          Effect.zipRight(Effect.fail(new Unauthorized({ message: SIGN_IN })))
        );
      }
      return {
        userId: session.user.id,
        organizationId: session.session.activeOrganizationId ?? null,
      } satisfies SessionUser;
    });

  /**
   * The signed-in user's GitHub token, refreshed if it has expired.
   *
   * GitHub App user tokens (`ghu_`) last only eight hours, while their refresh
   * tokens last six months. Reading the stored token directly meant every
   * write broke once a working day had passed, even though the session and the
   * refresh token were both still valid. `getAccessToken` performs the refresh
   * and persists the new pair.
   *
   * The cookie must be forwarded: better-auth rejects the call outright when
   * it sees request context without a resolvable session, before it considers
   * the userId in the body.
   */
  const userTokenFor = (cookie: string | undefined, userId: string) =>
    Effect.tryPromise(() =>
      auth.api.getAccessToken({
        body: { providerId: "github", userId },
        headers: new Headers(cookie ? { cookie } : {}),
      })
    ).pipe(
      Effect.tapErrorCause((cause) =>
        Effect.logWarning("github token refresh failed", cause)
      ),
      Effect.mapError(() => new Unauthorized({ message: RECONNECT_GITHUB })),
      Effect.flatMap((result) =>
        result.accessToken
          ? Effect.succeed(result.accessToken)
          : Effect.logWarning("no github token after refresh").pipe(
              Effect.zipRight(
                Effect.fail(new Unauthorized({ message: RECONNECT_GITHUB }))
              )
            )
      ),
      Effect.annotateLogs({ "user.id": userId }),
      Effect.withSpan("GitHubAuth.userTokenFor")
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
      Effect.flatMap((session) => userTokenFor(cookie, session.userId)),
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
        token: userTokenFor(cookie, session.userId),
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
