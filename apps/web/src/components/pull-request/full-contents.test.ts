import { describe, expect, test } from "bun:test";
import { getSingularPatch } from "@pierre/diffs";
import { withFullContents } from "./full-contents";

const PATCH = [
  "diff --git a/f.ts b/f.ts",
  "--- a/f.ts",
  "+++ b/f.ts",
  "@@ -3,4 +3,5 @@",
  " c",
  " d",
  "+E",
  " e",
  " f",
].join("\n");

const NEW_CONTENT = "a\nb\nc\nd\nE\ne\nf\ng\n";

describe("withFullContents", () => {
  test("grafts full file lines and reconstructs the old side", () => {
    const diff = withFullContents(getSingularPatch(PATCH), NEW_CONTENT);

    expect(diff.isPartial).toBe(false);
    expect(diff.additionLines).toEqual([
      "a\n",
      "b\n",
      "c\n",
      "d\n",
      "E\n",
      "e\n",
      "f\n",
      "g\n",
    ]);
    expect(diff.deletionLines.map((line) => line.trimEnd())).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
    ]);
  });

  test("reindexes hunks and content blocks to absolute line positions", () => {
    const diff = withFullContents(getSingularPatch(PATCH), NEW_CONTENT);
    const [hunk] = diff.hunks;

    expect(hunk.additionLineIndex).toBe(2);
    expect(hunk.deletionLineIndex).toBe(2);
    const lastBlock = hunk.hunkContent.at(-1);
    expect(
      lastBlock &&
        diff.additionLines[lastBlock.additionLineIndex].trimEnd() === "e" &&
        diff.deletionLines[lastBlock.deletionLineIndex].trimEnd() === "e"
    ).toBe(true);
  });

  test("keeps content without a trailing newline intact", () => {
    const diff = withFullContents(
      getSingularPatch(PATCH),
      "a\nb\nc\nd\nE\ne\nf\ng"
    );
    expect(diff.additionLines.at(-1)).toBe("g");
    expect(diff.additionLines).toHaveLength(8);
  });
});
