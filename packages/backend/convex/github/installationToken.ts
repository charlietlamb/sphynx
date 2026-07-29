import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";

/**
 * A live installation token for reads that run as the app. Wraps the cached
 * mint action so actions across the codebase resolve tokens one way.
 */
export async function getInstallationToken(
  ctx: ActionCtx,
  installationId: number,
  now: number,
): Promise<string> {
  return await ctx.runAction(internal.github.appAuth.installationToken, {
    installationId,
    now,
  });
}
