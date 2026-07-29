const PR_NUMBER_PATTERN = /#(\d+)\b/;

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
