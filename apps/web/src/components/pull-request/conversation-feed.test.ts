import { describe, expect, test } from "bun:test";
import type { ReviewThread } from "@sphynx/schema/pull-request-comments";
import type {
  Conversation,
  ConversationEvent,
} from "@sphynx/schema/pull-request-conversation";
import type { PullRequestSummary } from "@sphynx/schema/pull-requests";
import { buildConversationFeed } from "./conversation-feed";

const author = { login: "octocat", avatarUrl: "https://avatars.test/octocat" };

const summary = (overrides: Partial<PullRequestSummary> = {}) =>
  ({
    repository: {
      id: 1,
      owner: "o",
      name: "r",
      url: "https://github.com/o/r",
    },
    number: 1,
    title: "Title",
    body: null,
    state: "open",
    draft: false,
    author,
    base: { ref: "main", sha: "a" },
    head: { ref: "feature", sha: "b" },
    stats: {
      commits: 1,
      changedFiles: 1,
      additions: 1,
      deletions: 1,
      comments: 0,
      reviewComments: 0,
    },
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-05T00:00:00Z",
    mergedAt: null,
    githubUrl: "https://github.com/o/r/pull/1",
    ...overrides,
  }) as PullRequestSummary;

const comment = (id: string, createdAt: string) => ({
  id,
  author,
  body: id,
  bodyHTML: null,
  createdAt,
  githubUrl: "",
});

const review = (id: string, submittedAt: string) => ({
  id,
  author,
  verdict: "approved" as const,
  body: "",
  bodyHTML: null,
  submittedAt,
  githubUrl: "",
  commentCount: 0,
});

const commitEvent = (id: string, at: string): ConversationEvent => ({
  id,
  kind: "commit",
  at,
  actor: author,
  detail: `commit ${id}`,
  ref: id,
  url: null,
});

const conversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  descriptionHTML: null,
  comments: [],
  reviews: [],
  events: [],
  ...overrides,
});

const thread = (createdAt: string): ReviewThread => ({
  id: "T_1",
  path: "src/index.ts",
  line: 10,
  side: "additions",
  startLine: null,
  isResolved: false,
  isOutdated: false,
  viewerCanResolve: false,
  comments: [
    {
      id: 1,
      body: "thread comment",
      author,
      createdAt,
      githubUrl: "",
      pending: false,
    },
  ],
});

describe("buildConversationFeed", () => {
  test("interleaves sources chronologically with stable ties", () => {
    const feed = buildConversationFeed(
      summary(),
      conversation({
        comments: [comment("c1", "2026-07-02T00:00:00Z")],
        reviews: [review("r1", "2026-07-03T00:00:00Z")],
        events: [
          {
            id: "e1",
            kind: "labeled",
            at: "2026-07-02T00:00:00Z",
            actor: author,
            detail: "bug",
            ref: null,
            url: null,
          },
        ],
      }),
      [thread("2026-07-01T12:00:00Z")]
    );
    expect(feed.map((item) => item.kind)).toEqual([
      "thread",
      "comment",
      "event",
      "review",
    ]);
  });

  test("anchors threads at their first comment and skips empty threads", () => {
    const empty = { ...thread("2026-07-01T00:00:00Z"), comments: [] };
    const feed = buildConversationFeed(summary(), conversation(), [empty]);
    expect(feed).toEqual([]);
  });

  test("groups consecutive commits and splits on interruptions", () => {
    const feed = buildConversationFeed(
      summary(),
      conversation({
        comments: [comment("c1", "2026-07-02T00:00:00Z")],
        events: [
          commitEvent("a", "2026-07-01T00:00:00Z"),
          commitEvent("b", "2026-07-01T01:00:00Z"),
          commitEvent("c", "2026-07-03T00:00:00Z"),
        ],
      }),
      []
    );
    expect(feed.map((item) => item.kind)).toEqual([
      "commits",
      "comment",
      "commits",
    ]);
    const first = feed[0];
    expect(first?.kind === "commits" && first.commits.length).toBe(2);
  });

  test("derives a merged state row only when no merged event exists", () => {
    const merged = summary({
      state: "merged",
      mergedAt: "2026-07-04T00:00:00Z",
    });
    const derived = buildConversationFeed(merged, conversation(), []);
    expect(derived).toEqual([
      { kind: "state", at: "2026-07-04T00:00:00Z", state: "merged" },
    ]);
    const withEvent = buildConversationFeed(
      merged,
      conversation({
        events: [
          {
            id: "m1",
            kind: "merged",
            at: "2026-07-04T00:00:00Z",
            actor: author,
            detail: null,
            ref: "abc1234",
            url: null,
          },
        ],
      }),
      []
    );
    expect(withEvent.map((item) => item.kind)).toEqual(["event"]);
  });

  test("derives a closed row for closed pulls without events", () => {
    const feed = buildConversationFeed(
      summary({ state: "closed" }),
      conversation(),
      []
    );
    expect(feed).toEqual([
      { kind: "state", at: "2026-07-05T00:00:00Z", state: "closed" },
    ]);
  });

  test("returns empty feed for empty conversation", () => {
    expect(buildConversationFeed(summary(), conversation(), [])).toEqual([]);
  });
});
