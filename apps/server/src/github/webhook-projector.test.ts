import { describe, expect, test } from "bun:test";
import { projectionFor } from "./webhook-projector";

const envelope = {
  installation: { id: 42 },
  repository: { name: "widgets", owner: { login: "acme" } },
};

describe("projectionFor", () => {
  test("pull_request targets the pull", () => {
    const projection = projectionFor("pull_request", {
      ...envelope,
      pull_request: { number: 7 },
    });
    expect(projection).toEqual({
      _tag: "Pull",
      installationId: 42,
      ref: { owner: "acme", repo: "widgets", number: 7 },
    });
  });

  test("pull_request_review_thread targets the pull", () => {
    const projection = projectionFor("pull_request_review_thread", {
      ...envelope,
      pull_request: { number: 9 },
    });
    expect(projection._tag).toBe("Pull");
  });

  test("issue_comment on a PR targets the pull", () => {
    const projection = projectionFor("issue_comment", {
      ...envelope,
      issue: { number: 3, pull_request: { url: "x" } },
    });
    expect(projection).toEqual({
      _tag: "Pull",
      installationId: 42,
      ref: { owner: "acme", repo: "widgets", number: 3 },
    });
  });

  test("issue_comment on a plain issue is ignored", () => {
    const projection = projectionFor("issue_comment", {
      ...envelope,
      issue: { number: 3 },
    });
    expect(projection._tag).toBe("None");
  });

  test("check_run targets the linked pull", () => {
    const projection = projectionFor("check_run", {
      ...envelope,
      check_run: { pull_requests: [{ number: 11 }] },
    });
    expect(projection).toEqual({
      _tag: "Pull",
      installationId: 42,
      ref: { owner: "acme", repo: "widgets", number: 11 },
    });
  });

  test("check_run with no linked pull is ignored", () => {
    const projection = projectionFor("check_run", {
      ...envelope,
      check_run: { pull_requests: [] },
    });
    expect(projection._tag).toBe("None");
  });

  test("check_suite falls back to its own pull list", () => {
    const projection = projectionFor("check_suite", {
      ...envelope,
      check_suite: { pull_requests: [{ number: 13 }] },
    });
    expect(projection._tag).toBe("Pull");
  });

  test("push is not a per-PR refresh", () => {
    expect(projectionFor("push", envelope)._tag).toBe("None");
  });

  test("installation triggers a backfill", () => {
    expect(projectionFor("installation", { installation: { id: 42 } })).toEqual(
      { _tag: "Install", installationId: 42 }
    );
  });

  test("installation_repositories triggers a backfill", () => {
    expect(
      projectionFor("installation_repositories", {
        installation: { id: 42 },
      })._tag
    ).toBe("Install");
  });

  test("a delivery missing the installation is ignored", () => {
    const projection = projectionFor("pull_request", {
      repository: { name: "widgets", owner: { login: "acme" } },
      pull_request: { number: 7 },
    });
    expect(projection._tag).toBe("None");
  });
});
