import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

/**
 * Open PR numbers whose head is a given commit sha — resolves a legacy commit
 * status (which names a sha, not a PR) to the PRs it should refresh.
 */
export const pullNumbersForHead = internalQuery({
  args: { owner: v.string(), repo: v.string(), headSha: v.string() },
  returns: v.array(v.number()),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("pullHead")
      .withIndex("by_owner_and_repo_and_headSha", (q) =>
        q.eq("owner", args.owner).eq("repo", args.repo).eq("headSha", args.headSha),
      )
      .collect();
    return rows.map((row) => row.number);
  },
});
