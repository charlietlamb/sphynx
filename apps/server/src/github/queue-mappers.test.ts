import { describe, expect, test } from "bun:test";
import { failingChecks, previewBody } from "./queue-mappers";

describe("failingChecks", () => {
  test("collects failed check runs and status contexts", () => {
    expect(
      failingChecks([
        {
          __typename: "CheckRun",
          name: "build",
          conclusion: "SUCCESS",
          detailsUrl: null,
        },
        {
          __typename: "CheckRun",
          name: "typecheck",
          conclusion: "FAILURE",
          detailsUrl: "https://github.com/checks/1",
        },
        {
          __typename: "StatusContext",
          context: "vercel",
          state: "ERROR",
          targetUrl: "https://vercel.com/deploy/1",
        },
        {
          __typename: "StatusContext",
          context: "ci/lint",
          state: "SUCCESS",
          targetUrl: null,
        },
      ])
    ).toEqual([
      { name: "typecheck", url: "https://github.com/checks/1" },
      { name: "vercel", url: "https://vercel.com/deploy/1" },
    ]);
  });

  test("dedupes repeated names from matrix jobs", () => {
    expect(
      failingChecks([
        {
          __typename: "CheckRun",
          name: "root workspace",
          conclusion: "FAILURE",
          detailsUrl: null,
        },
        {
          __typename: "CheckRun",
          name: "root workspace",
          conclusion: "FAILURE",
          detailsUrl: null,
        },
        {
          __typename: "CheckRun",
          name: "conduit",
          conclusion: "TIMED_OUT",
          detailsUrl: null,
        },
      ])
    ).toEqual([
      { name: "root workspace", url: null },
      { name: "conduit", url: null },
    ]);
  });

  test("caps the list at six names", () => {
    const contexts = Array.from({ length: 10 }, (_, index) => ({
      __typename: "CheckRun" as const,
      name: `check-${index}`,
      conclusion: "FAILURE",
      detailsUrl: null,
    }));
    expect(failingChecks(contexts)).toHaveLength(6);
  });
});

describe("previewBody", () => {
  test("takes the first meaningful line and strips markdown noise", () => {
    expect(
      previewBody("<!-- marker -->\n\n**Restart** indicator `cleared`")
    ).toBe("Restart indicator cleared");
  });

  test("strips html tags but keeps image alt text", () => {
    expect(
      previewBody(
        '<a href=""><img alt="P1" src="https://x/badges/p1.svg" align="top"></a> Missing cleanup on expiry'
      )
    ).toBe("P1 Missing cleanup on expiry");
  });

  test("truncates long bodies", () => {
    const body = "a".repeat(600);
    const preview = previewBody(body);
    expect(preview.length).toBeLessThanOrEqual(400);
    expect(preview.endsWith("…")).toBe(true);
  });
});
