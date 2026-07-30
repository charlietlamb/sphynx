"use node";

import { ConvexError, v } from "convex/values";
import { Effect, Schema } from "effect";
import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { authComponent } from "../auth";
import { configFromEnv, makeGitHubClient } from "./githubClient";
import { GitHubUnavailable } from "./githubErrors";
import { MAX_USER_INSTALLATIONS } from "./limits";
import { nextPageFrom } from "./pagination";
import { userToken } from "./userToken";

const InstallationListSchema = Schema.Struct({
  installations: Schema.Array(
    Schema.Struct({
      account: Schema.NullOr(
        Schema.Struct({
          login: Schema.String,
          type: Schema.String,
          avatar_url: Schema.String,
        })
      ),
      id: Schema.Number,
      repository_selection: Schema.String,
    })
  ),
  total_count: Schema.Number,
});

const RepositoryListSchema = Schema.Struct({
  repositories: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      owner: Schema.Struct({ login: Schema.String }),
    })
  ),
  total_count: Schema.Number,
});

const github = makeGitHubClient(configFromEnv());

const repositoriesPage = (
  token: string,
  installationId: number,
  page: number
) =>
  github
    .rest(
      token,
      "GET",
      `/user/installations/${installationId}/repositories?per_page=100&page=${page}`
    )
    .pipe(
      Effect.flatMap((response) =>
        Effect.tryPromise({
          try: () => response.json(),
          catch: () =>
            new GitHubUnavailable({
              message: "Invalid installation repositories",
            }),
        }).pipe(
          Effect.flatMap((json) =>
            Schema.decodeUnknown(RepositoryListSchema)(json).pipe(
              Effect.mapError(
                () =>
                  new GitHubUnavailable({
                    message: "Invalid installation repositories",
                  })
              )
            )
          ),
          Effect.map((body) => ({ body, link: response.header("link") }))
        )
      )
    );

/**
 * Every repository the installation can see, walked page by page over the
 * `rel="next"` link header. Unbounded — a large org simply pages through more
 * repositories.
 */
const collectRepositoryKeys = (token: string, installationId: number) =>
  Effect.gen(function* () {
    const keys: string[] = [];
    let page: number | null = 1;
    while (page !== null) {
      const { body, link } = yield* repositoriesPage(
        token,
        installationId,
        page
      );
      for (const repository of body.repositories) {
        keys.push(
          `${installationId}:${repository.owner.login.toLowerCase()}:${repository.name.toLowerCase()}`
        );
      }
      page = nextPageFrom(link);
    }
    return keys;
  });

async function repositoryKeys(token: string, installationId: number) {
  return await Effect.runPromise(collectRepositoryKeys(token, installationId));
}

/**
 * The installations the signed-in user can access, from GitHub as the user. A
 * live passthrough — the app can't materialize which installations a given user
 * belongs to. Feeds the org switcher.
 */
export const listInstallations = action({
  args: {},
  returns: v.object({
    installations: v.array(
      v.object({
        id: v.number(),
        accountLogin: v.string(),
        accountType: v.string(),
        avatarUrl: v.union(v.string(), v.null()),
        repositorySelection: v.string(),
      })
    ),
  }),
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    const token = await userToken(ctx);
    const body = await Effect.runPromise(
      github.restJson(
        token,
        "/user/installations?per_page=100",
        InstallationListSchema,
        "Invalid GitHub installations"
      )
    );
    if (
      body.total_count > body.installations.length ||
      body.installations.length > MAX_USER_INSTALLATIONS
    ) {
      throw new Error(
        `More than ${MAX_USER_INSTALLATIONS} GitHub App installations are not supported`
      );
    }
    const allowed = await ctx.runMutation(
      internal.github.access.consumeRateLimit,
      {
        key: `${user._id}:github`,
        limit: 120,
        windowMs: 60_000,
        now: Date.now(),
        cost: body.installations.length,
      }
    );
    if (!allowed) {
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: "Too many GitHub requests; try again shortly",
      });
    }
    const installations = body.installations.map((raw) => ({
      id: raw.id,
      accountLogin: raw.account?.login ?? "",
      accountType: raw.account?.type ?? "",
      avatarUrl: raw.account?.avatar_url ?? null,
      repositorySelection: raw.repository_selection,
    }));
    const verifiedAt = await ctx.runMutation(
      internal.github.access.syncInstallations,
      {
        userId: user._id,
        installations: installations.map((entry) => ({
          installationId: entry.id,
          accountLogin: entry.accountLogin,
        })),
        verifiedAt: Date.now(),
      }
    );
    for (const installation of installations) {
      await ctx.runMutation(internal.github.access.syncRepositories, {
        userId: user._id,
        installationId: installation.id,
        repoKeys: await repositoryKeys(token, installation.id),
        verifiedAt,
      });
    }
    return { installations };
  },
});
