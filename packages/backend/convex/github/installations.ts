"use node";

import { ConvexError, v } from "convex/values";
import { Effect, Schema } from "effect";
import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { authComponent } from "../auth";
import { configFromEnv, makeGitHubClient } from "./githubClient";
import {
  MAX_INSTALLATION_REPOSITORIES,
  MAX_USER_INSTALLATIONS,
} from "./limits";
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

async function repositoryKeys(token: string, installationId: number) {
  const body = await Effect.runPromise(
    github.restJson(
      token,
      `/user/installations/${installationId}/repositories?per_page=100`,
      RepositoryListSchema,
      "Invalid installation repositories"
    )
  );
  if (
    body.total_count > body.repositories.length ||
    body.repositories.length > MAX_INSTALLATION_REPOSITORIES
  ) {
    throw new Error(
      `More than ${MAX_INSTALLATION_REPOSITORIES} repositories per GitHub App installation are not supported`
    );
  }
  return body.repositories.map(
    (repository) =>
      `${installationId}:${repository.owner.login.toLowerCase()}:${repository.name.toLowerCase()}`
  );
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
