import { describe, expect, test } from "bun:test";
import { fingerprint } from "./pipeline-fingerprint";

describe("fingerprint", () => {
  test("changes when a repo's open pull count changes", () => {
    const before = fingerprint([
      { owner: "useautumn", repo: "autumn", openPulls: 2 },
    ]);
    const after = fingerprint([
      { owner: "useautumn", repo: "autumn", openPulls: 3 },
    ]);
    expect(before).not.toBe(after);
  });

  test("changes when a repo is added", () => {
    const before = fingerprint([
      { owner: "useautumn", repo: "autumn", openPulls: 2 },
    ]);
    const after = fingerprint([
      { owner: "useautumn", repo: "autumn", openPulls: 2 },
      { owner: "useautumn", repo: "docs", openPulls: 0 },
    ]);
    expect(before).not.toBe(after);
  });

  test("is stable for identical input", () => {
    const repos = [{ owner: "useautumn", repo: "autumn", openPulls: 2 }];
    expect(fingerprint(repos)).toBe(fingerprint([...repos]));
  });

  test("matches the shape the version probe reports", () => {
    expect(
      fingerprint([
        { owner: "useautumn", repo: "autumn", openPulls: 2 },
        { owner: "useautumn", repo: "docs", openPulls: 0 },
      ])
    ).toBe("useautumn/autumn:2|useautumn/docs:0");
  });
});
