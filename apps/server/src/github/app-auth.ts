import { createSign } from "node:crypto";
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";
import { GitHubUnavailable } from "@sphynx/schema/pull-requests";
import {
  Cache,
  Clock,
  Context,
  Duration,
  Effect,
  Layer,
  Redacted,
  Schema,
} from "effect";
import { GitHubConfig } from "./config";
import { type GitHubCredential, installationCredentialId } from "./credential";
import type { GitHubAuthedError } from "./errors";

/** GitHub caps app JWTs at 10 minutes; 9 leaves room for clock drift. */
const JWT_TTL_SECONDS = 540;
/** `iat` is backdated so a fast clock can't produce a future-dated token. */
const JWT_CLOCK_SKEW_SECONDS = 60;
/** Installation tokens live 60 minutes; refresh early so none expire in flight. */
const INSTALLATION_TOKEN_TTL = Duration.minutes(50);
const INSTALLATION_TOKEN_CAPACITY = 512;

const InstallationTokenSchema = Schema.Struct({
  token: Schema.String,
  expires_at: Schema.String,
});

const InstallationSchema = Schema.Struct({
  id: Schema.Number,
  account: Schema.NullOr(
    Schema.Struct({
      login: Schema.String,
      type: Schema.String,
      avatar_url: Schema.String,
    })
  ),
  repository_selection: Schema.String,
});

const UserInstallationsSchema = Schema.Struct({
  installations: Schema.Array(InstallationSchema),
});

export type Installation = typeof InstallationSchema.Type;

const base64Url = (value: string) => Buffer.from(value).toString("base64url");

const unreachable = () =>
  new GitHubUnavailable({ message: "GitHub is unreachable" });

const makeGitHubAppAuth = Effect.gen(function* () {
  const config = yield* GitHubConfig;
  const client = yield* HttpClient.HttpClient;

  /**
   * Signs a short-lived RS256 JWT proving we are the app. Cheap enough that
   * caching it would add more risk (stale clock) than it saves.
   */
  const appJwt = Effect.gen(function* () {
    const now = Math.floor((yield* Clock.currentTimeMillis) / 1000);
    const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = base64Url(
      JSON.stringify({
        iat: now - JWT_CLOCK_SKEW_SECONDS,
        exp: now + JWT_TTL_SECONDS,
        iss: config.app.clientId,
      })
    );
    const body = `${header}.${payload}`;
    const signature = yield* Effect.try({
      try: () => {
        const signer = createSign("RSA-SHA256");
        signer.update(body);
        return signer.sign(Redacted.value(config.app.privateKey), "base64url");
      },
      catch: () =>
        new GitHubUnavailable({ message: "Could not sign the GitHub App JWT" }),
    });
    return `${body}.${signature}`;
  });

  const request = <A, I>(
    bearer: string,
    method: "GET" | "POST",
    path: string,
    schema: Schema.Schema<A, I>
  ): Effect.Effect<A, GitHubAuthedError> =>
    HttpClientRequest.make(method)(`${config.apiUrl}${path}`).pipe(
      HttpClientRequest.setHeaders({
        accept: "application/vnd.github+json",
        "x-github-api-version": config.apiVersion,
      }),
      HttpClientRequest.bearerToken(bearer),
      client.execute,
      Effect.mapError(unreachable),
      Effect.flatMap((response) =>
        response.status >= 400
          ? Effect.fail(
              new GitHubUnavailable({
                message: `GitHub rejected the app request (${response.status})`,
              })
            )
          : HttpClientResponse.schemaBodyJson(schema)(response).pipe(
              Effect.mapError(
                () =>
                  new GitHubUnavailable({
                    message: "Invalid GitHub app response",
                  })
              )
            )
      ),
      Effect.timeoutFail({
        duration: config.timeout,
        onTimeout: () =>
          new GitHubUnavailable({ message: "GitHub request timed out" }),
      })
    );

  const mintInstallationToken = (installationId: number) =>
    appJwt.pipe(
      Effect.flatMap((jwt) =>
        request(
          jwt,
          "POST",
          `/app/installations/${installationId}/access_tokens`,
          InstallationTokenSchema
        )
      ),
      Effect.map((minted) => minted.token),
      Effect.withSpan("GitHubAppAuth.mintInstallationToken"),
      Effect.annotateLogs({ "github.installation_id": installationId })
    );

  const tokens = yield* Cache.make({
    capacity: INSTALLATION_TOKEN_CAPACITY,
    timeToLive: INSTALLATION_TOKEN_TTL,
    lookup: mintInstallationToken,
  });

  const installationCredential = (
    installationId: number
  ): GitHubCredential => ({
    kind: "installation",
    id: installationCredentialId(installationId),
    token: tokens.get(installationId),
  });

  const listUserInstallations = (userToken: string) =>
    request(
      userToken,
      "GET",
      "/user/installations?per_page=100",
      UserInstallationsSchema
    ).pipe(
      Effect.map((page) => page.installations),
      Effect.withSpan("GitHubAppAuth.listUserInstallations")
    );

  return { installationCredential, listUserInstallations };
});

export class GitHubAppAuth extends Context.Tag("@sphynx/server/GitHubAppAuth")<
  GitHubAppAuth,
  Effect.Effect.Success<typeof makeGitHubAppAuth>
>() {}

export const GitHubAppAuthLive = Layer.scoped(GitHubAppAuth, makeGitHubAppAuth);
