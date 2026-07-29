"use node";

import { Effect } from "effect";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { buildPipeline, discoverRepos, repoEvents } from "./pipelineBuilder";
import { toWorkbenchEvents } from "./workbenchMappers";

const SEED_REPOS = 10;

async function token(ctx: ActionCtx, installationId: number, now: number) {
  return await ctx.runAction(internal.github.appAuth.installationToken, {
    installationId,
    now,
  });
}

/**
 * Seed the workbench feed with recent Events-API history for the first repos.
 * Steady-state feed updates arrive via webhooks; this only runs at backfill /
 * resync. Idempotent on the Events-API id, best-effort per repo.
 */
async function seedWorkbench(
  ctx: ActionCtx,
  installationId: number,
  repos: readonly { owner: string; repo: string }[],
  accessToken: string,
) {
  for (const entry of repos.slice(0, SEED_REPOS)) {
    try {
      const raw = await Effect.runPromise(repoEvents(entry, accessToken));
      const events = toWorkbenchEvents(entry.owner, entry.repo, raw);
      if (events.length > 0) {
        await ctx.runMutation(internal.github.workbench.writeWorkbenchEvents, {
          events: events.map((event) => ({
            eventId: event.id,
            installationId,
            owner: entry.owner,
            repo: entry.repo,
            kind: event.kind,
            actor: event.actor.login,
            actorAvatarUrl: event.actor.avatarUrl || null,
            pullNumber: event.pull?.number ?? null,
            title: event.pull?.title ?? null,
            detail: event.detail,
            url: event.url,
            occurredAt: new Date(event.at).getTime(),
          })),
        });
      }
    } catch {
      /** A repo that fails to seed still gets live events going forward. */
    }
  }
}

/**
 * Build an installation's full pipeline from GitHub and write it to the read
 * model, one repo per mutation to stay under the write cap. `snapshotAt` is
 * stamped before touching GitHub so a webhook opening a PR mid-fetch is not
 * clobbered as merged. Never reuses a persisted ETag — a full read every time.
 */
export const materialize = internalAction({
  args: {
    installationId: v.number(),
    now: v.number(),
    seed: v.boolean(),
  },
  returns: v.object({ repoCount: v.number() }),
  handler: async (ctx, args): Promise<{ repoCount: number }> => {
    const snapshotAt = args.now;
    const accessToken = await token(ctx, args.installationId, args.now);
    const pipeline = await Effect.runPromise(buildPipeline(accessToken));
    for (const flow of pipeline.repos) {
      await ctx.runMutation(internal.github.writer.writeRepoFlow, {
        installationId: args.installationId,
        flow,
        snapshotAt,
        now: args.now,
      });
    }
    if (args.seed) {
      const discovered = await Effect.runPromise(discoverRepos(accessToken));
      await seedWorkbench(ctx, args.installationId, discovered, accessToken);
    }
    return { repoCount: pipeline.repos.length };
  },
});
