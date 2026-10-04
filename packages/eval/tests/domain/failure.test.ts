import { describe, expect, it } from "bun:test";
import { Cause } from "effect";
import { SandboxUnavailable } from "../../src/domain/errors";
import { describeCause, describeError } from "../../src/domain/failure";

describe("describeError", () => {
  it("keeps the connection error a wrapped failure hides", () => {
    const refused = new Error("connect ECONNREFUSED 127.0.0.1:443");
    const fetchFailed = new Error("fetch failed", { cause: refused });

    expect(
      describeError(new Error("request failed", { cause: fetchFailed }))
    ).toBe("request failed: connect ECONNREFUSED 127.0.0.1:443");
    expect(describeError(new Error("plain"))).toBe("plain");
  });
});

describe("describeCause", () => {
  /** The case that prompted this: a provider limit stored as a thousand
   * characters of stack, rendered under every failed row in the list. */
  it("reads the reason a tagged error already carries", () => {
    const failure = describeCause(
      Cause.fail(
        new SandboxUnavailable({
          provider: "daytona",
          reason: "Total disk limit exceeded. Maximum allowed: 30GiB.",
        })
      )
    );

    expect(failure).toBe("Total disk limit exceeded. Maximum allowed: 30GiB.");
  });

  /** The provider writes several lines; a row is one line high. */
  it("keeps the first line of a reason that runs on", () => {
    const failure = describeCause(
      Cause.fail(
        new SandboxUnavailable({
          provider: "daytona",
          reason: "Total disk limit exceeded.\nConsider archiving sandboxes.",
        })
      )
    );

    expect(failure).toBe("Total disk limit exceeded.");
  });

  it("truncates a reason too long for a row", () => {
    const failure = describeCause(
      Cause.fail(
        new SandboxUnavailable({ provider: "daytona", reason: "x".repeat(400) })
      )
    );

    expect(failure.length).toBeLessThanOrEqual(241);
    expect(failure.endsWith("…")).toBe(true);
  });

  /** A defect has no reason to read, so the first line of the rendered cause
   * is the best available, and still one line rather than a stack. */
  it("falls back to one line for a failure carrying no reason", () => {
    const failure = describeCause(Cause.die(new Error("socket hang up")));

    expect(failure).toContain("socket hang up");
    expect(failure).not.toContain("\n");
  });

  /* The defect this catches: Cause.pretty recorded straight into the row put two
     kilobytes of stack in the column a person reads. */
  it("records no stack for a cause that carries one", () => {
    const deep = new Error("connect ECONNREFUSED 10.0.0.1:443");
    deep.stack = [
      "Error: connect ECONNREFUSED 10.0.0.1:443",
      "    at TCPConnectWrap.afterConnect (node:net:1611:16)",
      "    at /Users/someone/sphynx/packages/eval/src/adapters/sandbox.ts:24:9",
    ].join("\n");

    const failure = describeCause(Cause.die(deep));

    expect(failure).toContain("ECONNREFUSED");
    expect(failure).not.toContain("\n");
    expect(failure).not.toContain("at TCPConnectWrap");
    expect(failure).not.toContain("/Users/");
    expect(failure.length).toBeLessThanOrEqual(241);
  });
});

describe("describeError on errors with nothing beneath them", () => {
  it("keeps what the error itself says", () => {
    const blank = new Error("cleared below");
    blank.message = "";

    expect([
      describeError(blank),
      describeError(
        new SandboxUnavailable({ provider: "e2b", reason: "quota reached" })
      ),
    ]).toEqual(["Error", "quota reached"]);
  });
});
