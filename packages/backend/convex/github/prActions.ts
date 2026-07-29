"use node";

import { v } from "convex/values";
import { Effect } from "effect";
import { action } from "../_generated/server";
import { addConversationComment as addConversationCommentProgram } from "./conversationWrite";
import {
  validateLineRange,
  validateRef,
  validateSha,
  validateText,
} from "./input";
import {
  getCommentThreads,
  getConversation,
  getFileContents,
  getPullSummary,
  listPatches,
} from "./prReads";
import {
  conversationValidator,
  patchesValidator,
  pullSummaryValidator,
  threadsValidator,
} from "./prValidators";
import {
  createComment,
  discardReview,
  pendingReview,
  replyToComment,
  resolveThread,
  submitReview,
} from "./reviews";
import { userTokenForRepository } from "./userToken";
import { listViewedFiles, setAllFilesViewed, setFileViewed } from "./viewer";

const refArgs = {
  owner: v.string(),
  repo: v.string(),
  number: v.number(),
} as const;

const sideValidator = v.union(v.literal("additions"), v.literal("deletions"));

export const getSummary = action({
  args: refArgs,
  returns: pullSummaryValidator,
  handler: async (ctx, args) => {
    validateRef(args);
    const token = await userTokenForRepository(ctx, args.owner, args.repo);
    return await Effect.runPromise(getPullSummary(args, token));
  },
});

export const getPatches = action({
  args: refArgs,
  returns: patchesValidator,
  handler: async (ctx, args) => {
    validateRef(args);
    const token = await userTokenForRepository(ctx, args.owner, args.repo, 5);
    return await Effect.runPromise(listPatches(args, token));
  },
});

export const getFileContentsAction = action({
  args: { ...refArgs, path: v.string(), sha: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    validateRef(args);
    validateText("Path", args.path, 4096);
    validateSha(args.sha);
    const token = await userTokenForRepository(ctx, args.owner, args.repo);
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
  returns: conversationValidator,
  handler: async (ctx, args) => {
    validateRef(args);
    const token = await userTokenForRepository(ctx, args.owner, args.repo);
    return await Effect.runPromise(getConversation(args, token));
  },
});

export const getThreads = action({
  args: refArgs,
  returns: threadsValidator,
  handler: async (ctx, args) => {
    validateRef(args);
    const token = await userTokenForRepository(ctx, args.owner, args.repo, 20);
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
    validateRef(args);
    const token = await userTokenForRepository(ctx, args.owner, args.repo);
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
    validateRef(args);
    validateText("Review body", args.body, 65_536);
    validateText("Path", args.path, 4096);
    validateSha(args.commitSha);
    validateLineRange(args.line, args.startLine);
    const token = await userTokenForRepository(ctx, args.owner, args.repo);
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
  args: { ...refArgs, body: v.string(), commentId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    validateRef(args);
    validateText("Reply body", args.body, 65_536);
    validateText("Comment ID", args.commentId, 100);
    const token = await userTokenForRepository(ctx, args.owner, args.repo);
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
  args: {
    owner: v.string(),
    repo: v.string(),
    number: v.number(),
    threadId: v.string(),
    resolved: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    validateText("Thread ID", args.threadId, 200);
    validateRef(args);
    const token = await userTokenForRepository(ctx, args.owner, args.repo, 2);
    await Effect.runPromise(
      resolveThread(
        { owner: args.owner, repo: args.repo, number: args.number },
        { threadId: args.threadId, resolved: args.resolved },
        token
      )
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
    validateRef(args);
    if (args.body !== null) {
      validateText("Review body", args.body, 65_536, true);
    }
    const token = await userTokenForRepository(ctx, args.owner, args.repo);
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
    validateRef(args);
    const token = await userTokenForRepository(ctx, args.owner, args.repo);
    await Effect.runPromise(discardReview(args, token));
    return null;
  },
});

export const getViewedFiles = action({
  args: refArgs,
  returns: v.array(v.object({ path: v.string(), viewed: v.boolean() })),
  handler: async (ctx, args) => {
    validateRef(args);
    const token = await userTokenForRepository(ctx, args.owner, args.repo, 20);
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
    validateRef(args);
    validateText("Path", args.path, 4096);
    const token = await userTokenForRepository(ctx, args.owner, args.repo);
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
    validateRef(args);
    const token = await userTokenForRepository(ctx, args.owner, args.repo, 100);
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
    validateRef(args);
    validateText("Comment body", args.body, 65_536);
    const token = await userTokenForRepository(ctx, args.owner, args.repo);
    return await Effect.runPromise(
      addConversationCommentProgram(
        { owner: args.owner, repo: args.repo, number: args.number },
        args.body,
        token
      )
    );
  },
});
