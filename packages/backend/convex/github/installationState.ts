import type { QueryCtx } from "../_generated/server";

export async function isInstallationRetired(
  ctx: QueryCtx,
  installationId: number
) {
  const installation = await ctx.db
    .query("installation")
    .withIndex("by_installationId", (q) =>
      q.eq("installationId", installationId)
    )
    .unique();
  return installation?.retiredAt !== undefined;
}

export async function ownsMaterializationRun(
  ctx: QueryCtx,
  installationId: number,
  runId: string
) {
  const [retired, lease] = await Promise.all([
    isInstallationRetired(ctx, installationId),
    ctx.db
      .query("materializationLease")
      .withIndex("by_installation", (q) =>
        q.eq("installationId", installationId)
      )
      .unique(),
  ]);
  return !retired && lease?.runId === runId;
}
