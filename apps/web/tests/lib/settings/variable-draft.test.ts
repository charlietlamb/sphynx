import { describe, expect, it } from "bun:test";
import {
  completeRows,
  type DraftRow,
  looksLikeEnv,
  pasteInto,
  rowProblem,
  tooMany,
} from "../../../src/lib/settings/variable-draft";

const row = (name: string, value = "v"): DraftRow => ({
  id: name,
  name,
  value,
});

describe("variable draft", () => {
  it("flags reserved, malformed and repeated names", () => {
    const rows = [row("SPHYNX_TOKEN"), row("lower"), row("A"), row("A")];

    expect(rowProblem(rows, 0, [], "organization")?.message).toContain(
      "reserved"
    );
    expect(rowProblem(rows, 1, [], "organization")?.message).toBe(
      "Use capital letters, digits and underscores"
    );
    expect(rowProblem(rows, 2, [], "organization")).toBeNull();
    expect(rowProblem(rows, 3, [], "organization")?.message).toBe(
      "This name is already in the list"
    );
  });

  it("warns when a name replaces one at the same scope", () => {
    const existing = [
      { name: "A", preview: "sk-…1234", scope: "organization" },
    ];

    expect(rowProblem([row("A")], 0, existing, "organization")).toEqual({
      field: "value",
      message: "Replaces sk-…1234 on save",
      tone: "warning",
    });
    expect(rowProblem([row("A")], 0, existing, "personal")).toBeNull();
  });

  it("pastes entries in place and keeps one empty row last", () => {
    const rows = pasteInto([row("", "")], 0, [
      { name: "A", value: "1" },
      { name: "B", value: "2" },
    ]);

    expect(rows.map(({ name, value }) => ({ name, value }))).toEqual([
      { name: "A", value: "1" },
      { name: "B", value: "2" },
      { name: "", value: "" },
    ]);
  });

  it("submits only rows with a name and a value", () => {
    expect(completeRows([row("A"), row("B", ""), row("", "x")])).toEqual([
      { name: "A", value: "v" },
    ]);
  });

  it("refuses a value longer than the API takes", () => {
    expect(
      rowProblem([row("A", "x".repeat(32_769))], 0, [], "organization")
    ).toEqual({
      field: "value",
      message: "Values hold at most 32,768 characters",
      tone: "error",
    });
    expect(
      rowProblem([row("A", "x".repeat(32_768))], 0, [], "organization")
    ).toBeNull();
  });

  it("asks to remove rows past one hundred", () => {
    const rows = (count: number) =>
      Array.from({ length: count }, (_, index) => row(`V_${index}`));

    expect(tooMany(rows(100))).toBeNull();
    expect(tooMany(rows(103))).toBe(
      "Add up to 100 at a time. Remove 3 to continue."
    );
  });

  it("treats multi line text or text with = as an env paste", () => {
    expect(looksLikeEnv("A=1")).toBe(true);
    expect(looksLikeEnv("one\ntwo")).toBe(true);
    expect(looksLikeEnv("ANTHROPIC")).toBe(false);
  });
});
