import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { testModules as modules } from "../test.helpers";

const ref = {
  installationId: 990_001,
  owner: "acme",
  repo: "widgets",
  number: 7,
  now: 1_785_000_000_000,
  runId: "run-1",
};

const setup = () => convexTest(schema, modules);
type T = ReturnType<typeof setup>;

const claim = (t: T) => t.mutation(internal.github.refresh.claimRefresh, ref);
const complete = (t: T) =>
  t.mutation(internal.github.refresh.completeRefresh, ref);

describe("pullRefresh debounce", () => {
  test("an expired claim is recoverable", async () => {
    const t = setup();
    expect(await claim(t)).toBe("run");
    const takeover = {
      ...ref,
      now: ref.now + 2 * 60 * 1000 + 1,
      runId: "run-2",
    };
    expect(
      await t.mutation(internal.github.refresh.claimRefresh, takeover)
    ).toBe("run");
    expect(await complete(t)).toBe("lost");
    await t.mutation(internal.github.refresh.releaseRefresh, {
      installationId: ref.installationId,
      owner: ref.owner,
      repo: ref.repo,
      number: ref.number,
      runId: ref.runId,
    });
    expect(
      await t.mutation(internal.github.refresh.completeRefresh, takeover)
    ).toBe("done");
  });

  test("release after a failed runner allows the next claim", async () => {
    const t = setup();
    await claim(t);
    await t.mutation(internal.github.refresh.releaseRefresh, {
      installationId: ref.installationId,
      owner: ref.owner,
      repo: ref.repo,
      number: ref.number,
      runId: ref.runId,
    });
    expect(await claim(t)).toBe("run");
  });

  test("the first claim runs, a concurrent claim is queued", async () => {
    const t = setup();
    expect(await claim(t)).toBe("run");
    expect(await claim(t)).toBe("queued");
    expect(await claim(t)).toBe("queued");
  });

  test("complete after a queued delivery reruns once, then is done", async () => {
    const t = setup();
    await claim(t);
    await claim(t);
    expect(await complete(t)).toBe("rerun");
    expect(await complete(t)).toBe("done");
  });

  test("complete with no pending delivery is done immediately", async () => {
    const t = setup();
    await claim(t);
    expect(await complete(t)).toBe("done");
  });

  test("a burst of N claims collapses to one run plus one rerun", async () => {
    const t = setup();
    const claims = [
      await claim(t),
      await claim(t),
      await claim(t),
      await claim(t),
    ];
    expect(claims).toEqual(["run", "queued", "queued", "queued"]);
    expect(await complete(t)).toBe("rerun");
    expect(await complete(t)).toBe("done");
  });

  test("after a full cycle a new claim runs again (row cleared)", async () => {
    const t = setup();
    await claim(t);
    await complete(t);
    expect(await claim(t)).toBe("run");
  });
});
