import { HttpClient, HttpClientResponse } from "@effect/platform";
import { Cache, Context, Duration, Effect, Layer, Ref, Schema } from "effect";
import { GitHubConfig } from "./config";
import { makeRest } from "./http";

const VIEWER_TTL = Duration.hours(1);

const RawViewerSchema = Schema.Struct({ login: Schema.String });

/**
 * Resolves the GitHub login behind a credential — the "viewer" the workbench
 * feed uses to mark a user's own actions. Cached per credential id (never the
 * raw token, which rotates hourly). A failed lookup resolves to null and is not
 * cached, so one transient error does not pin missing attribution for an hour.
 */
const makeViewerLogin = Effect.gen(function* () {
  const config = yield* GitHubConfig;
  const client = yield* HttpClient.HttpClient;
  const rest = makeRest(config, client);

  const tokens = yield* Ref.make(new Map<string, string>());

  const cache = yield* Cache.make({
    capacity: 128,
    timeToLive: VIEWER_TTL,
    lookup: (credentialId: string) =>
      Ref.get(tokens).pipe(
        Effect.flatMap((live) => {
          const token = live.get(credentialId);
          return token
            ? Effect.succeed(token)
            : Effect.dieMessage(`no token registered for ${credentialId}`);
        }),
        Effect.flatMap((token) => rest(token, "GET", "/user")),
        Effect.flatMap((response) =>
          HttpClientResponse.schemaBodyJson(RawViewerSchema)(response)
        ),
        Effect.map((viewer) => viewer.login),
        Effect.withSpan("ViewerLogin.fetch")
      ),
  });

  const resolve = (credentialId: string, token: string) =>
    Ref.update(tokens, (live) => new Map(live).set(credentialId, token)).pipe(
      Effect.zipRight(cache.get(credentialId)),
      Effect.tapError(() => cache.invalidate(credentialId)),
      Effect.orElseSucceed(() => null),
      Effect.withSpan("ViewerLogin.resolve"),
      Effect.annotateLogs({ "github.credential": credentialId })
    );

  return { resolve };
});

export class ViewerLogin extends Context.Tag("@sphynx/server/ViewerLogin")<
  ViewerLogin,
  Effect.Effect.Success<typeof makeViewerLogin>
>() {}

export const ViewerLoginLive = Layer.scoped(ViewerLogin, makeViewerLogin);
