import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../_generated/api";
import { api } from "../_generated/api";
import schema from "../schema";
import type { QueuePull } from "./domain";
import { repoKeyOf } from "./rows";
import { testModules as modules } from "../test.helpers";

const setup = () => convexTest(schema, modules);
type T = ReturnType<typeof setup>;

const INSTALL = 555;
const OWNER = "acme";
const REPO = "widgets";

const pull = (over: Partial<QueuePull>): QueuePull => ({
  owner: OWNER,
  repo: REPO,
  number: 1,
  title: "Test",
  hasBody: false,
  author: { login: "octocat", avatarUrl: null },
  isDraft: false,
  state: "open",
  mergedAt: null,
  updatedAt: "2026-07-01T00:00:00Z",
  additions: 1,
  deletions: 0,
  changedFiles: 1,
  ci: "success",
  headRefName: "feature/a",
  baseRefName: "dev",
  reviewers: [],
  reviewerCount: 0,
  botReviewerCount: 0,
  approvals: 0,
  changesRequested: 0,
  unresolvedThreads: 0,
  ciFailures: [],
  ciCounts: { failed: 0, passed: 0, pending: 0 },
  threadPreviews: [],
  decision: "needs-eyes",
  blocker: null,
  ...over,
});

const materialize = (t: T, flow: Parameters<typeof pull>[0][]) =>
  t.mutation(internal.github.writer.writeRepoFlow, {
    installationId: INSTALL,
    flow: {
      owner: OWNER,
      repo: REPO,
      stages: ["dev", "main"],
      openPulls: flow.map(pull),
      gaps: [
        {
          from: "dev",
          to: "main",
          aheadBy: 0,
          directCommits: 0,
          promotionPull: null,
          pulls: [],
        },
      ],
    },
    snapshotAt: new Date("2026-07-01T00:00:00Z").getTime(),
    now: new Date("2026-07-01T00:00:00Z").getTime(),
  });

describe("read model queries", () => {
  test("getPipeline reconstructs repo flows with derived counters", async () => {
    const t = setup();
    await materialize(t, [
      {
        number: 1,
        decision: "ready",
        reviewers: [
          {
            name: "alice",
            kind: "human",
            avatarUrl: null,
            state: "approved",
            score: null,
            submittedAt: "2026-07-01T10:00:00Z",
          },
          {
            name: "bot",
            kind: "bot",
            avatarUrl: null,
            state: "changes-requested",
            score: "2/5",
            submittedAt: "2026-07-01T11:00:00Z",
          },
        ],
      },
    ]);
    const pipeline = await t.query(api.github.reader.getPipeline, {
      installationId: INSTALL,
    });
    expect(pipeline.repos).toHaveLength(1);
    const p = pipeline.repos[0]?.openPulls[0];
    expect(p?.decision).toBe("ready");
    expect(p?.reviewerCount).toBe(2);
    expect(p?.botReviewerCount).toBe(1);
    expect(p?.approvals).toBe(1);
    expect(p?.changesRequested).toBe(1);
    expect(pipeline.repos[0]?.gaps).toHaveLength(1);
  });

  test("getQueue omits the promotion rail", async () => {
    const t = setup();
    await materialize(t, [{ number: 1 }]);
    const queue = await t.query(api.github.reader.getQueue, {
      installationId: INSTALL,
    });
    expect(queue.repos[0]?.gaps).toEqual([]);
    expect(queue.repos[0]?.openPulls).toHaveLength(1);
  });

  test("a repo with no open pulls does not surface in the pipeline", async () => {
    const t = setup();
    const pipeline = await t.query(api.github.reader.getPipeline, {
      installationId: INSTALL,
    });
    expect(pipeline.repos).toEqual([]);
  });

  test("installationForOwner resolves from the read model", async () => {
    const t = setup();
    await materialize(t, [{ number: 1 }]);
    const id = await t.query(api.github.reader.installationForOwner, {
      owner: OWNER,
    });
    expect(id).toBe(INSTALL);
    const missing = await t.query(api.github.reader.installationForOwner, {
      owner: "nobody",
    });
    expect(missing).toBeNull();
  });

  test("getRepoPulls returns one repo's open pulls", async () => {
    const t = setup();
    await materialize(t, [{ number: 1 }, { number: 2 }]);
    const pulls = await t.query(api.github.reader.getRepoPulls, {
      installationId: INSTALL,
      owner: OWNER,
      repo: REPO,
    });
    expect(pulls).toHaveLength(2);
    expect(repoKeyOf(INSTALL, OWNER, REPO)).toBe(`${INSTALL}:acme:widgets`);
  });
});
