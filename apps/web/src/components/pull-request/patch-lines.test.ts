import { describe, expect, test } from "bun:test";
import {
  definitionScrollLine,
  patchHunkStarts,
  patchNewLines,
  stepPatchLine,
} from "./patch-lines";

const PATCH = [
  "@@ -1,3 +10,4 @@",
  " context ten",
  "+added eleven",
  "-removed old",
  " context twelve",
  " context thirteen",
  "@@ -20,2 +40,2 @@",
  " context forty",
  "+added forty-one",
].join("\n");

describe("patchNewLines", () => {
  test("collects new-side line numbers across hunks, skipping deletions", () => {
    expect(patchNewLines(PATCH)).toEqual([10, 11, 12, 13, 40, 41]);
  });
});

describe("definitionScrollLine", () => {
  const PATCH_WITH_DOC = [
    "@@ -1,0 +1,7 @@",
    "+const before = 1;",
    "+",
    "+/**",
    "+ * Adds things.",
    "+ */",
    "+export function addThings() {}",
    "+const after = 2;",
  ].join("\n");

  test("includes the comment block and one padding line above", () => {
    expect(definitionScrollLine(PATCH_WITH_DOC, 6)).toBe(2);
  });

  test("returns the definition when nothing above is in the patch", () => {
    const patch = "@@ -10,0 +10,1 @@\n+export function loneThing() {}";
    expect(definitionScrollLine(patch, 10)).toBe(10);
  });

  test("uses the previous line as padding when there is no comment", () => {
    expect(definitionScrollLine(PATCH_WITH_DOC, 7)).toBe(6);
  });

  test("keeps freeform block comments with unstarred interior lines", () => {
    const patch = [
      "@@ -1,0 +1,6 @@",
      "+const before = 1;",
      "+/*",
      "+  plain interior text",
      "+*/",
      "+export function blockDocumented() {}",
      "+const after = 2;",
    ].join("\n");
    expect(definitionScrollLine(patch, 5)).toBe(1);
  });
});

describe("stepPatchLine", () => {
  test("steps forward and backward through existing lines", () => {
    expect(stepPatchLine(PATCH, 11, 1)).toBe(12);
    expect(stepPatchLine(PATCH, 11, -1)).toBe(10);
  });

  test("jumps across hunk gaps", () => {
    expect(stepPatchLine(PATCH, 13, 1)).toBe(40);
    expect(stepPatchLine(PATCH, 40, -1)).toBe(13);
  });

  test("steps to the nearest patch line when starting between hunks", () => {
    expect(stepPatchLine(PATCH, 25, 1)).toBe(40);
    expect(stepPatchLine(PATCH, 25, -1)).toBe(13);
  });

  test("clamps at the edges and starts from null", () => {
    expect(stepPatchLine(PATCH, 10, -1)).toBe(10);
    expect(stepPatchLine(PATCH, 41, 1)).toBe(41);
    expect(stepPatchLine(PATCH, null, 1)).toBe(10);
    expect(stepPatchLine(PATCH, null, -1)).toBe(41);
  });
});

describe("patchHunkStarts", () => {
  test("returns the first new line of each hunk", () => {
    const patch = [
      "@@ -1,3 +1,4 @@",
      " a",
      "+b",
      " c",
      " d",
      "@@ -10,2 +11,3 @@",
      " x",
      "+y",
      " z",
    ].join("\n");
    expect(patchHunkStarts(patch)).toEqual([1, 11]);
  });

  test("returns an empty list for an empty patch", () => {
    expect(patchHunkStarts("")).toEqual([]);
  });
});
