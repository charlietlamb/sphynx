import { describe, expect, test } from "bun:test";
import { groupReviewThreads } from "./review-threads";
import type { RawReviewComment } from "./schemas";

const rawComment = (
  overrides: Partial<RawReviewComment> & { id: number }
): RawReviewComment => ({
  body: `comment ${overrides.id}`,
  path: "src/app.ts",
  line: 10,
  side: "RIGHT",
  start_line: null,
  user: { login: "charlie", avatar_url: "https://avatar.test/charlie" },
  created_at: "2026-07-01T00:00:00Z",
  html_url: `https://github.com/o/r/pull/1#discussion_r${overrides.id}`,
  ...overrides,
});

describe("groupReviewThreads", () => {
  test("groups replies onto the parent thread via in_reply_to_id", () => {
    const threads = groupReviewThreads([
      rawComment({ id: 1 }),
      rawComment({ id: 2, in_reply_to_id: 1, body: "first reply" }),
      rawComment({ id: 3, in_reply_to_id: 1, body: "second reply" }),
      rawComment({ id: 4, line: 20 }),
    ]);

    expect(threads).toHaveLength(2);
    expect(threads[0]?.comments.map((c) => c.id)).toEqual([1, 2, 3]);
    expect(threads[0]?.comments[1]?.body).toBe("first reply");
    expect(threads[1]?.comments.map((c) => c.id)).toEqual([4]);
  });

  test("treats an orphan reply with a missing parent as its own root thread", () => {
    const threads = groupReviewThreads([
      rawComment({ id: 7, in_reply_to_id: 999, line: 5 }),
    ]);

    expect(threads).toHaveLength(1);
    expect(threads[0]?.line).toBe(5);
    expect(threads[0]?.comments.map((c) => c.id)).toEqual([7]);
  });

  test("skips comments with a null line", () => {
    const threads = groupReviewThreads([
      rawComment({ id: 1, line: null }),
      rawComment({ id: 2, line: 3 }),
    ]);

    expect(threads).toHaveLength(1);
    expect(threads[0]?.comments[0]?.id).toBe(2);
  });

  test("drops an orphan reply whose own line is null", () => {
    const threads = groupReviewThreads([
      rawComment({ id: 1, line: null }),
      rawComment({ id: 2, in_reply_to_id: 1, line: null }),
    ]);

    expect(threads).toHaveLength(0);
  });

  test("maps LEFT to deletions and everything else to additions", () => {
    const threads = groupReviewThreads([
      rawComment({ id: 1, side: "LEFT" }),
      rawComment({ id: 2, side: "RIGHT", line: 20 }),
      rawComment({ id: 3, side: null, line: 30 }),
    ]);

    expect(threads.map((t) => t.side)).toEqual([
      "deletions",
      "additions",
      "additions",
    ]);
  });

  test("passes start_line through and normalizes missing values to null", () => {
    const threads = groupReviewThreads([
      rawComment({ id: 1, start_line: 4, line: 10 }),
      rawComment({ id: 2, start_line: null, line: 20 }),
      rawComment({ id: 3, start_line: undefined, line: 30 }),
    ]);

    expect(threads.map((t) => t.startLine)).toEqual([4, null, null]);
  });

  test("uses REST-fallback thread flags and pending false", () => {
    const threads = groupReviewThreads([
      rawComment({ id: 1 }),
      rawComment({ id: 2, in_reply_to_id: 1 }),
    ]);

    const thread = threads[0];
    expect(thread).toMatchObject({
      id: null,
      isResolved: false,
      isOutdated: false,
      viewerCanResolve: false,
    });
    expect(thread?.comments.every((c) => c.pending === false)).toBe(true);
  });

  test("maps raw comment fields and a null user to a null author", () => {
    const threads = groupReviewThreads([
      rawComment({ id: 11, user: null }),
      rawComment({ id: 12, line: 20 }),
    ]);

    expect(threads[0]?.comments[0]).toEqual({
      id: 11,
      body: "comment 11",
      author: null,
      createdAt: "2026-07-01T00:00:00Z",
      githubUrl: "https://github.com/o/r/pull/1#discussion_r11",
      pending: false,
    });
    expect(threads[1]?.comments[0]?.author).toEqual({
      login: "charlie",
      avatarUrl: "https://avatar.test/charlie",
    });
  });
});
