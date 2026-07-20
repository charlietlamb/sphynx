const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

function walkPatchNewLines(
  patch: string,
  visit: (lineNumber: number, content: string) => void
) {
  const rows = patch.split("\n");
  if (rows.at(-1) === "") {
    rows.pop();
  }
  let newLine: number | null = null;
  for (const row of rows) {
    const hunk = HUNK_HEADER.exec(row);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }
    if (newLine === null || row.startsWith("-") || row.startsWith("\\")) {
      continue;
    }
    visit(newLine, row);
    newLine += 1;
  }
}

const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*)/;

export function definitionScrollLine(patch: string, line: number): number {
  const contents = new Map<number, string>();
  walkPatchNewLines(patch, (lineNumber, content) => {
    contents.set(lineNumber, content.slice(1));
  });
  let start = line;
  let inBlockComment = false;
  while (start > 1) {
    const above = contents.get(start - 1);
    if (above === undefined) {
      break;
    }
    if (!(inBlockComment || COMMENT_LINE.test(above))) {
      break;
    }
    start -= 1;
    const trimmed = above.trim();
    if (trimmed.includes("/*")) {
      inBlockComment = false;
    } else if (trimmed.includes("*/")) {
      inBlockComment = true;
    }
  }
  return contents.has(start - 1) ? start - 1 : start;
}

export function patchLineText(
  patch: string,
  start: number,
  end: number
): string[] {
  const lines: string[] = [];
  walkPatchNewLines(patch, (lineNumber, content) => {
    if (lineNumber >= start && lineNumber <= end) {
      lines.push(content.slice(1));
    }
  });
  return lines;
}

export function patchNewLines(patch: string): number[] {
  const lines: number[] = [];
  walkPatchNewLines(patch, (lineNumber) => {
    lines.push(lineNumber);
  });
  return lines;
}

export function patchHunkStarts(patch: string): number[] {
  const lines = patchNewLines(patch);
  return lines.filter(
    (line, index) => index === 0 || line !== lines[index - 1] + 1
  );
}

export function stepPatchLine(
  patch: string,
  current: number | null,
  direction: 1 | -1
): number | null {
  const lines = patchNewLines(patch);
  if (lines.length === 0) {
    return null;
  }
  if (current === null) {
    return direction === 1 ? lines[0] : (lines.at(-1) ?? null);
  }
  const index = lines.findIndex((line) => line >= current);
  if (index === -1) {
    return lines.at(-1) ?? null;
  }
  const exact = lines[index] === current;
  let nextIndex = index + direction;
  if (!exact) {
    nextIndex = direction === 1 ? index : index - 1;
  }
  return lines[Math.min(Math.max(nextIndex, 0), lines.length - 1)];
}
