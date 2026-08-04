import { describe, expect, test } from "vitest";
import {
  commitPullNumbers,
  gapPairs,
  promotionPullsForGap,
} from "./pipelineHelpers";

describe("gapPairs", () => {
  test("adds a backflow pair from the top stage to the bottom", () => {
    expect(gapPairs(["dev", "staging", "main"])).toEqual([
      ["dev", "staging"],
      ["staging", "main"],
      ["main", "dev"],
    ]);
  });

  test("a two-stage chain promotes up and backflows down", () => {
    expect(gapPairs(["dev", "main"])).toEqual([
      ["dev", "main"],
      ["main", "dev"],
    ]);
  });

  test("a single-stage chain has no pairs", () => {
    expect(gapPairs(["main"])).toEqual([]);
  });
});

const pull = (number: number, headRefName: string) => ({
  number,
  headRefName,
});

describe("promotionPullsForGap", () => {
  test("drops a backmerge whose head is the gap target", () => {
    // dev -> main gap: #2568 is a main -> dev sync (head=main), #2570 is a real
    // feature promotion merged into dev (head=feature).
    const pulls = [pull(2568, "main"), pull(2570, "feature/x")];
    const kept = promotionPullsForGap(pulls, "main");
    expect(kept.map((p) => p.number)).toEqual([2570]);
  });

  test("keeps every genuine promotion (feature heads)", () => {
    const pulls = [pull(1, "feat/a"), pull(2, "feat/b"), pull(3, "fix/c")];
    expect(promotionPullsForGap(pulls, "main").map((p) => p.number)).toEqual([
      1, 2, 3,
    ]);
  });

  test("drops every pull when they are all backmerges from the target", () => {
    const pulls = [pull(1, "main"), pull(2, "main")];
    expect(promotionPullsForGap(pulls, "main")).toEqual([]);
  });

  test("is empty for an empty input", () => {
    expect(promotionPullsForGap([], "main")).toEqual([]);
  });

  test("the scrape-then-filter round trip keeps only the real promotion", () => {
    // main...dev after a main -> dev sync: dev carries the sync's own merge
    // commit plus a genuine dev -> main promotion. Both leave a #N in the
    // compare; only the one whose head is not main is a real promotion.
    const commits = [
      "Sync main into dev (#2568)",
      "feat: ship the thing (#2570)",
    ];
    const { numbers } = commitPullNumbers(commits);
    expect(numbers).toEqual([2568, 2570]);

    const looked = [pull(2568, "main"), pull(2570, "feature/thing")];
    const promotions = promotionPullsForGap(looked, "main");
    expect(promotions.map((p) => p.number)).toEqual([2570]);
  });
});
