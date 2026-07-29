import { describe, expect, test } from "vitest";
import { shouldApplyPullWrite } from "./gate";

const ts = (iso: string) => new Date(iso).getTime();

describe("shouldApplyPullWrite", () => {
  test("a first write always applies", () => {
    expect(
      shouldApplyPullWrite(
        null,
        { state: "open", ghUpdatedAt: ts("2026-07-01T00:00:00Z") },
        ts("2026-07-01T00:00:00Z")
      )
    ).toBe(true);
  });

  test("a stale rewrite does not clobber a newer row", () => {
    const current = {
      state: "open",
      ghUpdatedAt: ts("2026-07-05T00:00:00Z"),
      fetchedAt: ts("2026-07-05T00:00:01Z"),
    };
    expect(
      shouldApplyPullWrite(
        current,
        { state: "open", ghUpdatedAt: ts("2020-01-01T00:00:00Z") },
        ts("2026-07-05T12:00:00Z")
      )
    ).toBe(false);
  });

  test("a merged pull is not reopened by a lagging same-timestamp write", () => {
    const merged = "2026-07-05T00:00:00Z";
    const current = {
      state: "merged",
      ghUpdatedAt: ts(merged),
      fetchedAt: ts("2026-07-05T00:00:01Z"),
    };
    expect(
      shouldApplyPullWrite(
        current,
        { state: "open", ghUpdatedAt: ts(merged) },
        ts("2026-07-05T12:00:00Z")
      )
    ).toBe(false);
  });

  test("a genuine reopen with a newer timestamp does land", () => {
    const current = {
      state: "closed",
      ghUpdatedAt: ts("2026-07-05T00:00:00Z"),
      fetchedAt: ts("2026-07-05T00:00:01Z"),
    };
    expect(
      shouldApplyPullWrite(
        current,
        { state: "open", ghUpdatedAt: ts("2026-07-06T00:00:00Z") },
        ts("2026-07-06T12:00:00Z")
      )
    ).toBe(true);
  });

  test("a fresh webhook wins a same-ghUpdatedAt tie (fetchedAt < snapshotAt=now)", () => {
    const same = "2026-07-07T00:00:00Z";
    const current = {
      state: "open",
      ghUpdatedAt: ts(same),
      fetchedAt: ts("2026-07-07T00:00:00Z"),
    };
    expect(
      shouldApplyPullWrite(
        current,
        { state: "open", ghUpdatedAt: ts(same) },
        ts("2026-07-07T12:00:00Z")
      )
    ).toBe(true);
  });

  test("reconcile's older snapshot loses the tie to a newer webhook row", () => {
    const same = "2026-07-07T00:00:00Z";
    const current = {
      state: "open",
      ghUpdatedAt: ts(same),
      fetchedAt: ts("2026-07-07T13:00:00Z"),
    };
    expect(
      shouldApplyPullWrite(
        current,
        { state: "open", ghUpdatedAt: ts(same) },
        ts("2026-07-07T12:00:00Z")
      )
    ).toBe(false);
  });
});
