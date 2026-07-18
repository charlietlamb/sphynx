import { describe, expect, test } from "bun:test";
import {
  blockerFor,
  decide,
  isBotLogin,
  type PullSignals,
  parseScore,
} from "./queue-decision";

const signals = (overrides: Partial<PullSignals>): PullSignals => ({
  additions: 50,
  approvals: 1,
  changedFiles: 3,
  changesRequested: 0,
  ci: "success",
  isDraft: false,
  reviewerCount: 2,
  unresolvedThreads: 0,
  ...overrides,
});

describe("decide", () => {
  test("clean, reviewed, green pull is ready", () => {
    expect(decide(signals({}))).toBe("ready");
  });

  test("drafts stay in their own bucket", () => {
    expect(decide(signals({ isDraft: true }))).toBe("draft");
  });

  test("changes requested or red CI contest the pull", () => {
    expect(decide(signals({ changesRequested: 1 }))).toBe("contested");
    expect(decide(signals({ ci: "failure" }))).toBe("contested");
  });

  test("missing approvals, open threads, or thin coverage need eyes", () => {
    expect(decide(signals({ reviewerCount: 0, approvals: 0 }))).toBe(
      "needs-eyes"
    );
    expect(decide(signals({ approvals: 0 }))).toBe("needs-eyes");
    expect(decide(signals({ unresolvedThreads: 3 }))).toBe("needs-eyes");
    expect(decide(signals({ additions: 2000, reviewerCount: 1 }))).toBe(
      "needs-eyes"
    );
  });
});

describe("blockerFor", () => {
  test("orders reasons by severity", () => {
    expect(blockerFor(signals({ ci: "failure", changesRequested: 2 }))).toBe(
      "CI failing"
    );
    expect(blockerFor(signals({ changesRequested: 2 }))).toBe(
      "changes requested ×2"
    );
    expect(blockerFor(signals({ unresolvedThreads: 1 }))).toBe(
      "1 unresolved thread"
    );
    expect(blockerFor(signals({ reviewerCount: 0, approvals: 0 }))).toBe(
      "no reviews yet"
    );
    expect(blockerFor(signals({ approvals: 0 }))).toBe("no approvals yet");
    expect(blockerFor(signals({}))).toBeNull();
  });
});

describe("isBotLogin", () => {
  test("detects bots by typename, suffix, and known logins", () => {
    expect(isBotLogin("coderabbitai", "Bot")).toBe(true);
    expect(isBotLogin("something[bot]")).toBe(true);
    expect(isBotLogin("Copilot")).toBe(true);
    expect(isBotLogin("charlietlamb")).toBe(false);
  });
});

describe("parseScore", () => {
  test("extracts labelled and bare scores", () => {
    expect(parseScore("Overall score: 8/10 — solid change")).toBe("8/10");
    expect(parseScore("**Rating** 4.5/5")).toBe("4.5/5");
    expect(parseScore("quality 92/100 across the diff")).toBe("92/100");
  });

  test("returns null when no score is present", () => {
    expect(parseScore("Looks good to me")).toBeNull();
    expect(parseScore("fixes 3/4 of the issues listed")).toBeNull();
  });
});

describe("parseScore cubic marker", () => {
  test("reads the machine-readable confidence marker", () => {
    expect(
      parseScore(
        "<!-- cubic:review-summary:start -->\n<!-- cubic:review-summary:confidence-score:2/5 -->\n**7 issues found**"
      )
    ).toBe("2/5");
  });

  test("prefers the marker over prose numbers", () => {
    expect(
      parseScore(
        "<!-- cubic:review-summary:confidence-score:3/5 -->\nfound 7/10 issues resolved"
      )
    ).toBe("3/5");
  });
});
