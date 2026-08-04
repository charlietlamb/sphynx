import { describe, expect, test } from "vitest";
import { commitPullNumbers, promotionPullsForGap } from "./pipelineHelpers";

const pull = (number: number, baseRefName: string) => ({
  number,
  baseRefName,
});

describe("promotionPullsForGap", () => {
  test("drops a backmerge pull that landed on the lower branch", () => {
    const pulls = [pull(2568, "dev"), pull(2570, "main")];
    const kept = promotionPullsForGap(pulls, "main");
    expect(kept.map((p) => p.number)).toEqual([2570]);
  });

  test("keeps only pulls whose base is the gap target", () => {
    const pulls = [pull(1, "main"), pull(2, "staging"), pull(3, "main")];
    expect(promotionPullsForGap(pulls, "main").map((p) => p.number)).toEqual([
      1, 3,
    ]);
  });

  test("returns nothing when every pull points elsewhere", () => {
    const pulls = [pull(1, "dev"), pull(2, "dev")];
    expect(promotionPullsForGap(pulls, "main")).toEqual([]);
  });

  test("is empty for an empty input", () => {
    expect(promotionPullsForGap([], "main")).toEqual([]);
  });

  test("the scrape-then-filter round trip keeps only the real promotion", () => {
    // dev...main after a main -> dev sync: dev carries the sync's own merge
    // commit plus a genuine dev -> main promotion. Both leave a #N in the
    // compare; only the one whose base is main is a real promotion.
    const commits = [
      "Sync main into dev (#2568)",
      "feat: ship the thing (#2570)",
    ];
    const { numbers } = commitPullNumbers(commits);
    expect(numbers).toEqual([2568, 2570]);

    const looked = [pull(2568, "dev"), pull(2570, "main")];
    const promotions = promotionPullsForGap(looked, "main");
    expect(promotions.map((p) => p.number)).toEqual([2570]);
  });
});
