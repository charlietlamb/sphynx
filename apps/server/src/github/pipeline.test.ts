import { describe, expect, it } from "bun:test";
import {
  commitPullNumbers,
  dropStaleMiddleStages,
  stageChain,
} from "./pipeline";

describe("stageChain", () => {
  it("returns the default branch when there is no dev branch", () => {
    expect(
      stageChain({
        defaultBranch: "main",
        hasDev: false,
        hasStaging: false,
        prod: "main",
      })
    ).toEqual(["main"]);
  });

  it("keeps unusual default branches as a single stage", () => {
    expect(
      stageChain({
        defaultBranch: "containers/universal",
        hasDev: false,
        hasStaging: false,
        prod: "main",
      })
    ).toEqual(["containers/universal"]);
  });

  it("chains dev to prod even when dev is the default branch", () => {
    expect(
      stageChain({
        defaultBranch: "dev",
        hasDev: true,
        hasStaging: false,
        prod: "main",
      })
    ).toEqual(["dev", "main"]);
  });

  it("includes staging between dev and prod", () => {
    expect(
      stageChain({
        defaultBranch: "dev",
        hasDev: true,
        hasStaging: true,
        prod: "main",
      })
    ).toEqual(["dev", "staging", "main"]);
  });

  it("stops at dev when no prod branch exists", () => {
    expect(
      stageChain({
        defaultBranch: "dev",
        hasDev: true,
        hasStaging: false,
        prod: null,
      })
    ).toEqual(["dev"]);
  });
});

describe("dropStaleMiddleStages", () => {
  it("drops staging when it is far behind dev", () => {
    expect(dropStaleMiddleStages(["dev", "staging", "main"], 6176)).toEqual([
      "dev",
      "main",
    ]);
  });

  it("keeps staging when it is close to dev", () => {
    expect(dropStaleMiddleStages(["dev", "staging", "main"], 12)).toEqual([
      "dev",
      "staging",
      "main",
    ]);
  });

  it("keeps staging when the compare check failed", () => {
    expect(dropStaleMiddleStages(["dev", "staging", "main"], null)).toEqual([
      "dev",
      "staging",
      "main",
    ]);
  });

  it("leaves two-stage chains untouched", () => {
    expect(dropStaleMiddleStages(["dev", "main"], 9999)).toEqual([
      "dev",
      "main",
    ]);
  });
});

describe("commitPullNumbers", () => {
  it("extracts pull numbers from squash-merge subjects", () => {
    expect(
      commitPullNumbers([
        "feat: add usage caps (#241)",
        "fix: race in webhook retries (#238)",
      ])
    ).toEqual({ numbers: [241, 238], direct: 0 });
  });

  it("counts commits without a pull reference as direct", () => {
    expect(commitPullNumbers(["chore: bump deps", "fix: typo (#12)"])).toEqual({
      numbers: [12],
      direct: 1,
    });
  });

  it("dedupes repeated pull numbers", () => {
    expect(commitPullNumbers(["merge #7", "follow-up for #7 (#7)"])).toEqual({
      numbers: [7],
      direct: 0,
    });
  });

  it("ignores pull references beyond the first line", () => {
    expect(
      commitPullNumbers(["chore: release\n\nincludes #99 and #100"])
    ).toEqual({ numbers: [], direct: 1 });
  });
});
