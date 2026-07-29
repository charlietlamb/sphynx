import { describe, expect, test } from "vitest";
import {
  headCloseFor,
  headMoveFor,
  projectionFor,
  statusTargetFor,
  workbenchTargetFor,
} from "./projection";

const INSTALL = 148_913_111;
const REPO = { owner: { login: "useautumn" }, name: "autumn" };
const envelope = (extra: Record<string, unknown>) => ({
  installation: { id: INSTALL },
  repository: REPO,
  ...extra,
});

describe("projectionFor", () => {
  test("pull_request -> Pull with the PR number", () => {
    const p = projectionFor(
      "pull_request",
      envelope({ pull_request: { number: 42, head: { sha: "abc" } } }),
    );
    expect(p._tag).toBe("Pull");
    if (p._tag === "Pull") {
      expect(p.installationId).toBe(INSTALL);
      expect(p.ref).toEqual({ owner: "useautumn", repo: "autumn", number: 42 });
    }
  });

  test("pull_request_review -> Pull", () => {
    const p = projectionFor(
      "pull_request_review",
      envelope({ pull_request: { number: 7 }, review: { state: "approved" } }),
    );
    expect(p._tag).toBe("Pull");
  });

  test("pull_request_review_thread -> Pull", () => {
    const p = projectionFor(
      "pull_request_review_thread",
      envelope({ pull_request: { number: 9 } }),
    );
    expect(p._tag).toBe("Pull");
  });

  test("issue_comment on a PR -> Pull", () => {
    const p = projectionFor(
      "issue_comment",
      envelope({ issue: { number: 5, pull_request: { url: "x" } } }),
    );
    expect(p._tag).toBe("Pull");
    if (p._tag === "Pull") {
      expect(p.ref.number).toBe(5);
    }
  });

  test("issue_comment on a plain issue -> None", () => {
    const p = projectionFor(
      "issue_comment",
      envelope({ issue: { number: 5 } }),
    );
    expect(p._tag).toBe("None");
  });

  test("check_run -> Pull from the first associated PR", () => {
    const p = projectionFor(
      "check_run",
      envelope({ check_run: { pull_requests: [{ number: 11 }, { number: 12 }] } }),
    );
    expect(p._tag).toBe("Pull");
    if (p._tag === "Pull") {
      expect(p.ref.number).toBe(11);
    }
  });

  test("check_suite with no associated PR -> None", () => {
    const p = projectionFor(
      "check_suite",
      envelope({ check_suite: { pull_requests: [] } }),
    );
    expect(p._tag).toBe("None");
  });

  test("installation -> Install", () => {
    const p = projectionFor("installation", { installation: { id: INSTALL } });
    expect(p._tag).toBe("Install");
    if (p._tag === "Install") {
      expect(p.installationId).toBe(INSTALL);
    }
  });

  test("installation_repositories -> Install", () => {
    const p = projectionFor("installation_repositories", {
      installation: { id: INSTALL },
    });
    expect(p._tag).toBe("Install");
  });

  test("push -> None (handled by rail recompute, not a PR refresh)", () => {
    expect(projectionFor("push", envelope({}))._tag).toBe("None");
  });

  test("status -> None (resolved via head cursor, not projectionFor)", () => {
    expect(projectionFor("status", envelope({}))._tag).toBe("None");
  });

  test("an unknown event -> None", () => {
    expect(projectionFor("gollum", envelope({}))._tag).toBe("None");
  });
});

describe("headMoveFor / headCloseFor", () => {
  test("an open pull_request move records the head sha", () => {
    const move = headMoveFor(
      envelope({
        action: "synchronize",
        pull_request: { number: 3, state: "open", head: { sha: "deadbeef" } },
      }),
    );
    expect(move).toEqual({
      installationId: INSTALL,
      owner: "useautumn",
      repo: "autumn",
      number: 3,
      headSha: "deadbeef",
    });
  });

  test("a closed pull_request yields a head close", () => {
    const close = headCloseFor(
      envelope({
        action: "closed",
        pull_request: { number: 3, state: "closed", head: { sha: "x" } },
      }),
    );
    expect(close).toEqual({ owner: "useautumn", repo: "autumn", number: 3 });
  });
});

describe("statusTargetFor", () => {
  test("a status event yields the commit sha target", () => {
    const target = statusTargetFor(
      envelope({ sha: "c0ffee", state: "success" }),
    );
    expect(target).toEqual({
      installationId: INSTALL,
      owner: "useautumn",
      repo: "autumn",
      sha: "c0ffee",
    });
  });
});

describe("workbenchTargetFor", () => {
  test("an event with installation + repo yields a feed target", () => {
    const target = workbenchTargetFor(envelope({ sender: { login: "bot" } }));
    expect(target).toEqual({
      installationId: INSTALL,
      owner: "useautumn",
      repo: "autumn",
    });
  });

  test("an event missing the repository yields null", () => {
    expect(workbenchTargetFor({ installation: { id: INSTALL } })).toBeNull();
  });
});
