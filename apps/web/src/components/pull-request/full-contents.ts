import type { FileDiffMetadata, Hunk } from "@pierre/diffs";
import type { PullRequestFile } from "@sphynx/schema/pull-requests";

export function expandableFilePath(file: PullRequestFile | undefined) {
  if (!file?.patch) {
    return;
  }
  if (file.status === "added" || file.status === "deleted") {
    return;
  }
  return file.path;
}

function shiftedContent(
  hunk: Hunk,
  additionDelta: number,
  deletionDelta: number
) {
  return hunk.hunkContent.map((block) => ({
    ...block,
    additionLineIndex: block.additionLineIndex + additionDelta,
    deletionLineIndex: block.deletionLineIndex + deletionDelta,
  }));
}

const LINE_SPLIT = /(?<=\n)/;

export function withFullContents(
  diff: FileDiffMetadata,
  content: string
): FileDiffMetadata {
  const additionLines = content.length === 0 ? [] : content.split(LINE_SPLIT);
  const deletionLines: string[] = [];
  let nextNewLine = 0;
  for (const hunk of diff.hunks) {
    for (let line = nextNewLine; line < hunk.additionStart - 1; line += 1) {
      deletionLines.push(additionLines[line]);
    }
    deletionLines.push(
      ...diff.deletionLines.slice(
        hunk.deletionLineIndex,
        hunk.deletionLineIndex + hunk.deletionCount
      )
    );
    nextNewLine = hunk.additionStart - 1 + hunk.additionCount;
  }
  for (let line = nextNewLine; line < additionLines.length; line += 1) {
    deletionLines.push(additionLines[line]);
  }
  const hunks = diff.hunks.map((hunk) => ({
    ...hunk,
    additionLineIndex: hunk.additionStart - 1,
    deletionLineIndex: hunk.deletionStart - 1,
    hunkContent: shiftedContent(
      hunk,
      hunk.additionStart - 1 - hunk.additionLineIndex,
      hunk.deletionStart - 1 - hunk.deletionLineIndex
    ),
  }));
  return {
    ...diff,
    hunks,
    additionLines,
    deletionLines,
    isPartial: false,
    cacheKey: `${diff.name}:full:${content.length}`,
  };
}

const enrichedCache = new WeakMap<
  FileDiffMetadata,
  { content: string; enriched: FileDiffMetadata }
>();

export function enrichWithContents(
  diff: FileDiffMetadata,
  content: string
): FileDiffMetadata {
  const cached = enrichedCache.get(diff);
  if (cached?.content === content) {
    return cached.enriched;
  }
  const enriched = withFullContents(diff, content);
  enrichedCache.set(diff, { content, enriched });
  return enriched;
}
