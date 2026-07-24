import { describe, expect, test } from "bun:test";
import { endsWithMemberAccess } from "./diff-symbols";

describe("endsWithMemberAccess", () => {
  test("treats a single trailing dot as member access", () => {
    expect(endsWithMemberAccess("foo.")).toBe(true);
    expect(endsWithMemberAccess("plan.customerId.")).toBe(true);
  });

  test("does NOT treat a spread as member access", () => {
    // `...computeRollbackOperations` — the symbol must stay linkable.
    expect(endsWithMemberAccess("...")).toBe(false);
    expect(endsWithMemberAccess("return {\n    ...")).toBe(false);
  });

  test("plain preceding text is not member access", () => {
    expect(endsWithMemberAccess("")).toBe(false);
    expect(endsWithMemberAccess("const x =")).toBe(false);
    expect(endsWithMemberAccess("(")).toBe(false);
  });
});
