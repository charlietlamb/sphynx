import { describe, expect, it } from "bun:test";
import {
  clearSettledMerges,
  markMerged,
  unmarkMerged,
  withoutMerged,
} from "./pending-merges";

const pull = (number: number, extra?: Partial<Row>): Row => ({
  owner: "acme",
  repo: "web",
  number,
  ...extra,
});

interface Row {
  readonly number: number;
  readonly owner: string;
  readonly repo: string;
}

const pipeline = (numbers: number[]) => ({
  repos: [
    {
      owner: "acme",
      repo: "web",
      openPulls: numbers.map((n) => pull(n)),
    },
  ],
});

describe("pending-merges", () => {
  it("hides a just-merged pull that the stale read model still returns as open", () => {
    const store = markMerged({}, pull(7), 0);
    const stale = pipeline([7, 8]);

    const shown = withoutMerged(stale, store);

    expect(shown.repos[0].openPulls.map((p) => p.number)).toEqual([8]);
  });

  it("keeps unrelated pulls untouched", () => {
    const store = markMerged({}, pull(7), 0);
    const fresh = pipeline([8, 9]);

    const shown = withoutMerged(fresh, store);

    expect(shown.repos[0].openPulls.map((p) => p.number)).toEqual([8, 9]);
  });

  it("drops the tombstone once the server stops returning the pull as open", () => {
    const store = markMerged({}, pull(7), 0);
    const caughtUp = pipeline([8]);

    const settled = clearSettledMerges(caughtUp, store, 0);

    expect(
      withoutMerged(pipeline([7]), settled).repos[0].openPulls
    ).toHaveLength(1);
  });

  it("expires a tombstone after the safety window even if the read never caught up", () => {
    const store = markMerged({}, pull(7), 0);
    const stillStale = pipeline([7]);

    const settled = clearSettledMerges(stillStale, store, 60_000);

    expect(
      withoutMerged(pipeline([7]), settled).repos[0].openPulls
    ).toHaveLength(1);
  });

  it("brings a pull back when its merge fails and the tombstone is undone", () => {
    const store = markMerged({}, pull(7), 0);

    const reverted = unmarkMerged(store, pull(7));

    expect(
      withoutMerged(pipeline([7, 8]), reverted).repos[0].openPulls.map(
        (p) => p.number
      )
    ).toEqual([7, 8]);
  });

  it("keeps store identity stable when there is nothing to reconcile", () => {
    const store = markMerged({}, pull(7), 0);
    const stillStale = pipeline([7]);

    expect(clearSettledMerges(stillStale, store, 100)).toBe(store);
  });

  it("does not expire a fresh tombstone while the read is still stale", () => {
    const store = markMerged({}, pull(7), 0);
    const stillStale = pipeline([7]);

    const settled = clearSettledMerges(stillStale, store, 500);

    expect(
      withoutMerged(pipeline([7]), settled).repos[0].openPulls
    ).toHaveLength(0);
  });
});
