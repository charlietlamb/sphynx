import { describe, expect, test } from "bun:test";
import { toWorkbenchEvent, toWorkbenchEvents } from "./workbench-mappers";

const OWNER = "acme";
const REPO = "widgets";

function event(type: string, payload: unknown, overrides: object = {}) {
  return {
    id: "100",
    type,
    actor: { login: "charlie", avatar_url: "https://avatars.test/1" },
    created_at: "2026-07-18T12:00:00Z",
    payload,
    ...overrides,
  };
}

function convert(raw: unknown) {
  return toWorkbenchEvent(OWNER, REPO, raw);
}

describe("toWorkbenchEvent", () => {
  test("maps opened pull requests", () => {
    const mapped = convert(
      event("PullRequestEvent", {
        action: "opened",
        pull_request: {
          number: 12,
          title: "Add flux capacitor",
          html_url: "https://github.com/acme/widgets/pull/12",
          merged: null,
        },
      })
    );
    expect(mapped).toEqual({
      id: "100",
      at: "2026-07-18T12:00:00Z",
      actor: { login: "charlie", avatarUrl: "https://avatars.test/1" },
      kind: "pr-opened",
      pull: { number: 12, title: "Add flux capacitor" },
      detail: null,
      url: "https://github.com/acme/widgets/pull/12",
    });
  });

  test("splits closed into merged and closed", () => {
    const merged = convert(
      event("PullRequestEvent", {
        action: "closed",
        pull_request: { number: 1, title: "a", merged: true },
      })
    );
    const closed = convert(
      event("PullRequestEvent", {
        action: "closed",
        pull_request: { number: 2, title: "b", merged: false },
      })
    );
    const closedNoField = convert(
      event("PullRequestEvent", {
        action: "closed",
        pull_request: { number: 3, title: "c" },
      })
    );
    expect(merged?.kind).toBe("pr-merged");
    expect(closed?.kind).toBe("pr-closed");
    expect(closedNoField?.kind).toBe("pr-closed");
  });

  test("skips noisy pull actions", () => {
    for (const action of ["synchronize", "labeled", "assigned"]) {
      expect(
        convert(
          event("PullRequestEvent", {
            action,
            pull_request: { number: 1, title: "a" },
          })
        )
      ).toBeNull();
    }
  });

  test("maps review states", () => {
    const states: [string, string][] = [
      ["approved", "review-approved"],
      ["changes_requested", "review-changes"],
      ["commented", "review-commented"],
      ["mystery", "review-commented"],
    ];
    for (const [state, kind] of states) {
      const mapped = convert(
        event("PullRequestReviewEvent", {
          action: "created",
          review: { state, html_url: "https://github.com/r/1" },
          pull_request: { number: 5, title: "review me" },
        })
      );
      expect(mapped?.kind).toBe(kind as never);
    }
  });

  test("review comments carry a stripped snippet", () => {
    const mapped = convert(
      event("PullRequestReviewCommentEvent", {
        action: "created",
        comment: {
          html_url: "https://github.com/c/1",
          body: "<!-- marker -->\n**Fix** this",
          path: "src/index.ts",
        },
        pull_request: { number: 7, title: "t" },
      })
    );
    expect(mapped?.kind).toBe("comment");
    expect(mapped?.detail).toBe("Fix this");

    const empty = convert(
      event("PullRequestReviewCommentEvent", {
        action: "created",
        comment: { html_url: null, body: null, path: "src/a.ts" },
        pull_request: { number: 7, title: "t" },
      })
    );
    expect(empty?.detail).toBe("src/a.ts");
  });

  test("issue comments only link pulls when the issue is a pull", () => {
    const onPull = convert(
      event("IssueCommentEvent", {
        action: "created",
        issue: { number: 9, title: "pr", pull_request: {} },
        comment: { html_url: null, body: "hello there" },
      })
    );
    const onIssue = convert(
      event("IssueCommentEvent", {
        action: "created",
        issue: { number: 10, title: "issue" },
        comment: { html_url: null, body: "hello there" },
      })
    );
    expect(onPull?.pull).toEqual({ number: 9, title: "pr" });
    expect(onIssue?.pull).toBeNull();
  });

  test("pushes describe branch and commit count with a compare url", () => {
    const mapped = convert(
      event("PushEvent", {
        ref: "refs/heads/main",
        size: 5,
        distinct_size: 3,
        before: "abc",
        head: "def",
      })
    );
    expect(mapped?.detail).toBe("main · 3 commits");
    expect(mapped?.url).toBe(
      "https://github.com/acme/widgets/compare/abc...def"
    );

    const single = convert(
      event("PushEvent", { ref: "refs/heads/dev", size: 1 })
    );
    expect(single?.detail).toBe("dev · 1 commit");
    expect(single?.url).toBeNull();

    expect(convert(event("PushEvent", { ref: "refs/tags/v1" }))).toBeNull();

    const zero = convert(
      event("PushEvent", { ref: "refs/heads/main", size: 0, distinct_size: 0 })
    );
    expect(zero?.detail).toBe("main");
  });

  test("branch create and delete map, tags and repos skip", () => {
    const created = convert(
      event("CreateEvent", { ref: "feat/x", ref_type: "branch" })
    );
    const deleted = convert(
      event("DeleteEvent", { ref: "feat/x", ref_type: "branch" })
    );
    expect(created?.kind).toBe("branch-created");
    expect(created?.url).toBe("https://github.com/acme/widgets/tree/feat/x");
    expect(deleted?.kind).toBe("branch-deleted");
    expect(deleted?.url).toBeNull();
    expect(
      convert(event("CreateEvent", { ref: "v1", ref_type: "tag" }))
    ).toBeNull();
    expect(
      convert(event("CreateEvent", { ref: null, ref_type: "repository" }))
    ).toBeNull();
  });

  test("releases use the name with tag fallback", () => {
    const named = convert(
      event("ReleaseEvent", {
        action: "published",
        release: { name: null, tag_name: "v2.0", html_url: null },
      })
    );
    expect(named?.kind).toBe("release");
    expect(named?.detail).toBe("v2.0");
    expect(
      convert(
        event("ReleaseEvent", {
          action: "created",
          release: { name: null, tag_name: "v2.0", html_url: null },
        })
      )
    ).toBeNull();
  });

  test("strips bot suffixes from actors", () => {
    const mapped = convert(
      event(
        "PushEvent",
        { ref: "refs/heads/main", size: 1 },
        { actor: { login: "renovate[bot]", avatar_url: "https://a" } }
      )
    );
    expect(mapped?.actor.login).toBe("renovate");
  });

  test("skips unknown types and malformed envelopes", () => {
    expect(convert(event("WatchEvent", {}))).toBeNull();
    expect(
      convert(event("PushEvent", { ref: "refs/heads/x" }, { created_at: null }))
    ).toBeNull();
    expect(convert({})).toBeNull();
    expect(convert("garbage")).toBeNull();
  });
});

describe("toWorkbenchEvents", () => {
  test("keeps known events, skips junk, sorts newest first", () => {
    const events = toWorkbenchEvents(OWNER, REPO, [
      event(
        "PushEvent",
        { ref: "refs/heads/a", size: 1 },
        { id: "1", created_at: "2026-07-18T10:00:00Z" }
      ),
      event("WatchEvent", {}, { id: "2" }),
      {},
      "junk",
      event(
        "PushEvent",
        { ref: "refs/heads/b", size: 1 },
        { id: "3", created_at: "2026-07-18T11:00:00Z" }
      ),
    ]);
    expect(events.map((entry) => entry.id)).toEqual(["3", "1"]);
  });
});
