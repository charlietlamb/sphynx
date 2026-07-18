import { describe, expect, test } from "bun:test";
import { failingChecks, previewBody } from "./queue-mappers";

describe("failingChecks", () => {
  test("collects failed check runs and status contexts", () => {
    expect(
      failingChecks([
        { __typename: "CheckRun", name: "build", conclusion: "SUCCESS" },
        { __typename: "CheckRun", name: "typecheck", conclusion: "FAILURE" },
        { __typename: "StatusContext", context: "vercel", state: "ERROR" },
        { __typename: "StatusContext", context: "ci/lint", state: "SUCCESS" },
      ])
    ).toEqual(["typecheck", "vercel"]);
  });

  test("dedupes repeated names from matrix jobs", () => {
    expect(
      failingChecks([
        {
          __typename: "CheckRun",
          name: "root workspace",
          conclusion: "FAILURE",
        },
        {
          __typename: "CheckRun",
          name: "root workspace",
          conclusion: "FAILURE",
        },
        { __typename: "CheckRun", name: "conduit", conclusion: "TIMED_OUT" },
      ])
    ).toEqual(["root workspace", "conduit"]);
  });

  test("caps the list at six names", () => {
    const contexts = Array.from({ length: 10 }, (_, index) => ({
      __typename: "CheckRun" as const,
      name: `check-${index}`,
      conclusion: "FAILURE",
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
    const body = "a".repeat(400);
    const preview = previewBody(body);
    expect(preview.length).toBeLessThanOrEqual(180);
    expect(preview.endsWith("…")).toBe(true);
  });
});
