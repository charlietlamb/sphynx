import { v } from "convex/values";

const user = v.object({ login: v.string(), avatarUrl: v.string() });
const nullableUser = v.union(user, v.null());
const nullableString = v.union(v.string(), v.null());

export const pullSummaryValidator = v.object({
  repository: v.object({
    id: v.number(),
    owner: v.string(),
    name: v.string(),
    url: v.string(),
  }),
  number: v.number(),
  title: v.string(),
  body: nullableString,
  state: v.union(v.literal("open"), v.literal("closed"), v.literal("merged")),
  draft: v.boolean(),
  author: nullableUser,
  base: v.object({ ref: v.string(), sha: v.string() }),
  head: v.object({ ref: v.string(), sha: v.string() }),
  stats: v.object({
    commits: v.number(),
    changedFiles: v.number(),
    additions: v.number(),
    deletions: v.number(),
    comments: v.number(),
    reviewComments: v.number(),
  }),
  createdAt: v.string(),
  updatedAt: v.string(),
  mergedAt: nullableString,
  githubUrl: v.string(),
});

const pullFile = v.object({
  path: v.string(),
  previousPath: nullableString,
  sha: v.string(),
  status: v.union(
    v.literal("added"),
    v.literal("modified"),
    v.literal("deleted"),
    v.literal("renamed"),
    v.literal("copied"),
    v.literal("unknown")
  ),
  additions: v.number(),
  deletions: v.number(),
  changes: v.number(),
  renderability: v.union(v.literal("patch"), v.literal("binary-or-large")),
  githubUrl: v.string(),
});

export const patchesValidator = v.object({
  files: v.array(pullFile),
  patches: v.record(v.string(), v.string()),
  symbols: v.record(
    v.string(),
    v.object({
      kind: v.union(v.literal("member"), v.literal("top")),
      lineNumber: v.number(),
      path: v.string(),
      scope: v.union(v.literal("file"), v.literal("global")),
    })
  ),
});

export const conversationValidator = v.object({
  descriptionHTML: nullableString,
  comments: v.array(
    v.object({
      id: v.string(),
      author: nullableUser,
      body: v.string(),
      bodyHTML: nullableString,
      createdAt: v.string(),
      githubUrl: v.string(),
    })
  ),
  reviews: v.array(
    v.object({
      id: v.string(),
      author: nullableUser,
      isBot: v.optional(v.boolean()),
      verdict: v.union(
        v.literal("approved"),
        v.literal("changes-requested"),
        v.literal("commented"),
        v.literal("dismissed")
      ),
      body: v.string(),
      bodyHTML: nullableString,
      submittedAt: v.string(),
      githubUrl: v.string(),
      commentCount: v.number(),
    })
  ),
  events: v.array(
    v.object({
      id: v.string(),
      kind: v.union(
        v.literal("commit"),
        v.literal("force-push"),
        v.literal("labeled"),
        v.literal("unlabeled"),
        v.literal("review-requested"),
        v.literal("assigned"),
        v.literal("merged"),
        v.literal("closed"),
        v.literal("reopened"),
        v.literal("renamed")
      ),
      at: v.string(),
      actor: nullableUser,
      detail: nullableString,
      ref: nullableString,
      url: nullableString,
    })
  ),
});

export const threadsValidator = v.array(
  v.object({
    id: nullableString,
    path: v.string(),
    line: v.number(),
    side: v.union(v.literal("additions"), v.literal("deletions")),
    startLine: v.union(v.number(), v.null()),
    isResolved: v.boolean(),
    isOutdated: v.boolean(),
    viewerCanResolve: v.boolean(),
    comments: v.array(
      v.object({
        id: v.string(),
        body: v.string(),
        author: nullableUser,
        createdAt: v.string(),
        githubUrl: v.string(),
        pending: v.boolean(),
      })
    ),
  })
);
