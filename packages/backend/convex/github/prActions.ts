"use node";

import { ConvexError, v } from "convex/values";
import { Effect } from "effect";
import { api } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { action } from "../_generated/server";
import { addConversationComment as addConversationCommentProgram } from "./conversationWrite";
import { getInstallationToken } from "./installationToken";
import {
  getCommentThreads,
  getConversation,
  getFileContents,
  getPullSummary,
  listPatches,
} from "./prReads";
import {
  createComment,
  discardReview,
  pendingReview,
  replyToComment,
  resolveThread,
  submitReview,
} from "./reviews";
import { userToken } from "./userToken";
import { listViewedFiles, setAllFilesViewed, setFileViewed } from "./viewer";

const refArgs = {
  owner: v.string(),
  repo: v.string(),
  number: v.number(),
} as const;

const sideValidator = v.union(v.literal("additions"), v.literal("deletions"));

/**
 * The installation token for the app that owns the repo. Reads run as the
 * installation so they draw on its rate limit. A repo with no installation in
 * the read model cannot be read.
 */
async function readToken(ctx: ActionCtx, owner: string): Promise<string> {
  const installationId = await ctx.runQuery(
    api.github.reader.installationForOwner,
    { owner }
  );
  if (installationId === null) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: `No installation for ${owner}`,
    });
  }
  return await getInstallationToken(ctx, installationId, Date.now());
}

export const getSummary = action({
  args: refArgs,
  returns: v.any(),
  handler: async (ctx, args) => {
    const token = await readToken(ctx, args.owner);
    return await Effect.runPromise(getPullSummary(args, token));
  },
});

export const getPatches = action({
  args: refArgs,
  returns: v.any(),
  handler: async (ctx, args) => {
    const token = await readToken(ctx, args.owner);
    return await Effect.runPromise(listPatches(args, token));
  },
});

export const getFileContentsAction = action({
  args: { ...refArgs, path: v.string(), sha: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const token = await readToken(ctx, args.owner);
    return await Effect.runPromise(
      getFileContents(
        { owner: args.owner, repo: args.repo, number: args.number },
        args.path,
        args.sha,
        token
      )
    );
  },
});

export const getConversationAction = action({
  args: refArgs,
  returns: v.any(),
  handler: async (ctx, args) => {
    const token = await readToken(ctx, args.owner);
    return await Effect.runPromise(getConversation(args, token));
  },
});

export const getThreads = action({
  args: refArgs,
  returns: v.any(),
  handler: async (ctx, args) => {
    const token = await readToken(ctx, args.owner);
    return await Effect.runPromise(getCommentThreads(args, token));
  },
});

export const getPending = action({
  args: refArgs,
  returns: v.object({
    pendingId: v.union(v.string(), v.null()),
    commentCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const token = await userToken(ctx);
    return await Effect.runPromise(pendingReview(args, token));
  },
});

export const createReviewComment = action({
  args: {
    ...refArgs,
    body: v.string(),
    commitSha: v.string(),
    path: v.string(),
    line: v.number(),
    side: sideValidator,
    startLine: v.union(v.number(), v.null()),
    pending: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const token = await userToken(ctx);
    await Effect.runPromise(
      createComment(
        { owner: args.owner, repo: args.repo, number: args.number },
        {
          body: args.body,
          commitSha: args.commitSha,
          path: args.path,
          line: args.line,
          side: args.side,
          startLine: args.startLine,
          pending: args.pending,
        },
        token
      )
    );
    return null;
  },
});

export const replyToReviewComment = action({
  args: { ...refArgs, body: v.string(), commentId: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const token = await userToken(ctx);
    await Effect.runPromise(
      replyToComment(
        { owner: args.owner, repo: args.repo, number: args.number },
        { body: args.body, commentId: args.commentId },
        token
      )
    );
    return null;
  },
});

export const resolveReviewThread = action({
  args: { threadId: v.string(), resolved: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const token = await userToken(ctx);
    await Effect.runPromise(
      resolveThread({ threadId: args.threadId, resolved: args.resolved }, token)
    );
    return null;
  },
});

export const submitPendingReview = action({
  args: {
    ...refArgs,
    body: v.union(v.string(), v.null()),
    event: v.union(
      v.literal("APPROVE"),
      v.literal("REQUEST_CHANGES"),
      v.literal("COMMENT")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const token = await userToken(ctx);
    await Effect.runPromise(
      submitReview(
        { owner: args.owner, repo: args.repo, number: args.number },
        { body: args.body, event: args.event },
        token
      )
    );
    return null;
  },
});

export const discardPendingReview = action({
  args: refArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const token = await userToken(ctx);
    await Effect.runPromise(discardReview(args, token));
    return null;
  },
});

export const getViewedFiles = action({
  args: refArgs,
  returns: v.array(v.object({ path: v.string(), viewed: v.boolean() })),
  handler: async (ctx, args) => {
    const token = await userToken(ctx);
    return await Effect.runPromise(
      listViewedFiles(
        { owner: args.owner, repo: args.repo, number: args.number },
        token
      )
    );
  },
});

export const setViewedFile = action({
  args: { ...refArgs, path: v.string(), viewed: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const token = await userToken(ctx);
    await Effect.runPromise(
      setFileViewed(
        { owner: args.owner, repo: args.repo, number: args.number },
        args.path,
        args.viewed,
        token
      )
    );
    return null;
  },
});

export const setAllViewedFiles = action({
  args: { ...refArgs, viewed: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const token = await userToken(ctx);
    await Effect.runPromise(
      setAllFilesViewed(
        { owner: args.owner, repo: args.repo, number: args.number },
        args.viewed,
        token
      )
    );
    return null;
  },
});

export const addConversationComment = action({
  args: { ...refArgs, body: v.string() },
  returns: v.object({
    id: v.string(),
    author: v.union(
      v.object({ login: v.string(), avatarUrl: v.string() }),
      v.null()
    ),
    body: v.string(),
    bodyHTML: v.union(v.string(), v.null()),
    createdAt: v.string(),
    githubUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const token = await userToken(ctx);
    return await Effect.runPromise(
      addConversationCommentProgram(
        { owner: args.owner, repo: args.repo, number: args.number },
        args.body,
        token
      )
    );
  },
});
