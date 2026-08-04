const PR_NUMBER_PATTERN = /#(\d+)\b/;

/**
 * Drop the backmerge pulls from a gap's promotion list. A `lower -> upper` gap
 * scrapes `#N` from every commit in its `lower...upper` compare — the merge
 * commits of the pulls that landed on `lower` and are waiting to promote up. A
 * real promotion has a feature head merged into `lower` (`base === lower`); a
 * backmerge that synced `upper` back down into `lower` also lands on `lower`, so
 * its `#N` is in the compare too, but its head is `upper`. Keying on the head
 * being `upper` drops exactly those, leaving genuine promotions untouched —
 * where keying on the base cannot tell them apart (both merge into `lower`).
 */
export function promotionPullsForGap<T extends { headRefName: string }>(
  pulls: readonly T[],
  target: string
): T[] {
  return pulls.filter((pull) => pull.headRefName !== target);
}

/**
 * The `[source, target]` pairs a stage chain produces gaps for: each adjacent
 * upward promotion (`dev -> staging -> main`), plus one downward backflow from
 * the top stage to the bottom (`main -> dev`) so a hotfix that landed on the top
 * can be synced back down. The backflow is omitted for a single-stage chain,
 * where top and bottom coincide.
 */
export function gapPairs(stages: readonly string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let index = 0; index < stages.length - 1; index += 1) {
    pairs.push([stages[index] ?? "", stages[index + 1] ?? ""]);
  }
  const bottom = stages[0];
  const top = stages.at(-1);
  if (top !== undefined && bottom !== undefined && top !== bottom) {
    pairs.push([top, bottom]);
  }
  return pairs;
}

export function commitPullNumbers(messages: readonly string[]) {
  const numbers: number[] = [];
  let direct = 0;
  const seen = new Set<number>();
  for (const message of messages) {
    const firstLine = message.split("\n")[0] ?? "";
    const match = PR_NUMBER_PATTERN.exec(firstLine);
    if (match) {
      const number = Number(match[1]);
      if (!seen.has(number)) {
        seen.add(number);
        numbers.push(number);
      }
    } else {
      direct += 1;
    }
  }
  return { numbers, direct };
}

export function stageChain(refs: {
  defaultBranch: string;
  hasDev: boolean;
  hasStaging: boolean;
  prod: string | null;
}) {
  if (!refs.hasDev) {
    return [refs.defaultBranch];
  }
  const stages = ["dev"];
  if (refs.hasStaging) {
    stages.push("staging");
  }
  if (refs.prod && refs.prod !== "dev") {
    stages.push(refs.prod);
  }
  return stages;
}

const STALE_STAGE_THRESHOLD = 300;

export function dropStaleMiddleStages(
  stages: readonly string[],
  aheadOfMiddle: number | null
) {
  if (
    stages.length === 3 &&
    aheadOfMiddle !== null &&
    aheadOfMiddle > STALE_STAGE_THRESHOLD
  ) {
    const first = stages[0];
    const last = stages[2];
    return first && last ? [first, last] : [...stages];
  }
  return [...stages];
}
