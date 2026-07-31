import { Effect, Schema } from "effect";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { InstallationAccess } from "./accessContract";
import { configFromEnv, makeGitHubClient } from "./githubClient";
import { GitHubUnavailable } from "./githubErrors";
import { MAX_USER_INSTALLATIONS } from "./limits";
import { nextPageFrom } from "./pagination";

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
const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function chargeGitHubRequest(
  ctx: ActionCtx,
  userId: string,
  runId: string
) {
  while (
    !(await ctx.runMutation(internal.github.access.consumeRateLimit, {
      key: `${userId}:github`,
      limit: 120,
      windowMs: 60_000,
      now: Date.now(),
    }))
  ) {
    await wait(1000);
  }
  const renewed = await ctx.runMutation(
    internal.github.access.renewAccessRefresh,
    { userId, runId, now: Date.now() }
  );
  if (!renewed) {
    throw new Error("GitHub access refresh was superseded");
  }
}

async function parseRepositories(response: { json: () => Promise<unknown> }) {
  return await Effect.runPromise(
    Effect.tryPromise({
      try: () => response.json(),
      catch: () =>
        new GitHubUnavailable({
          message: "Invalid installation repositories",
        }),
    }).pipe(
      Effect.flatMap(Schema.decodeUnknown(RepositoryListSchema)),
      Effect.mapError(
        () =>
          new GitHubUnavailable({
            message: "Invalid installation repositories",
          })
      )
    )
  );
}

async function waitForRefresh(ctx: ActionCtx, userId: string) {
  while (true) {
    const status = await ctx.runQuery(
      internal.github.access.accessRefreshInProgress,
      { userId, now: Date.now() }
    );
    if (status !== "refreshing") {
      return status;
    }
    await wait(500);
  }
}

export async function refreshUserAccess(
  ctx: ActionCtx,
  userId: string,
  token: string
): Promise<{ installations: InstallationAccess[] }> {
  let runId: string;
  while (true) {
    runId = crypto.randomUUID();
    const lease = await ctx.runMutation(
      internal.github.access.beginAccessRefresh,
      { userId, runId, now: Date.now() }
    );
    if (lease.acquired) {
      break;
    }
    if ((await waitForRefresh(ctx, userId)) === "completed") {
      return {
        installations: await ctx.runQuery(
          internal.github.access.activeInstallations,
          { userId }
        ),
      };
    }
  }

  try {
    await chargeGitHubRequest(ctx, userId, runId);
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
    const installations = body.installations.map((raw) => ({
      id: raw.id,
      accountLogin: raw.account?.login ?? "",
      accountType: raw.account?.type ?? "",
      avatarUrl: raw.account?.avatar_url ?? null,
      repositorySelection: raw.repository_selection,
    }));

    for (const { id } of installations) {
      let page: number | null = 1;
      while (page !== null) {
        await chargeGitHubRequest(ctx, userId, runId);
        const response = await Effect.runPromise(
          github.rest(
            token,
            "GET",
            `/user/installations/${id}/repositories?per_page=100&page=${page}`
          )
        );
        const repositories = await parseRepositories(response);
        const staged = await ctx.runMutation(
          internal.github.access.stageRepositories,
          {
            userId,
            runId,
            installationId: id,
            repoKeys: repositories.repositories.map(
              (repository) =>
                `${id}:${repository.owner.login.toLowerCase()}:${repository.name.toLowerCase()}`
            ),
            now: Date.now(),
          }
        );
        if (!staged) {
          throw new Error("GitHub access refresh was superseded");
        }
        page = nextPageFrom(response.header("link"));
      }
    }

    const activated = await ctx.runMutation(
      internal.github.access.activateAccessRefresh,
      { userId, runId, installations, now: Date.now() }
    );
    if (!activated) {
      throw new Error("GitHub access refresh was superseded");
    }
    return { installations };
  } catch (error) {
    await ctx.runMutation(internal.github.access.abortAccessRefresh, {
      userId,
      runId,
    });
    throw error;
  }
}
