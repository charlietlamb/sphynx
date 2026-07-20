import {
  createParser,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";

export const PULL_REQUEST_TABS = ["diff", "conversation"] as const;

export type PullRequestTab = (typeof PULL_REQUEST_TABS)[number];

export interface DefinitionRef {
  anchorLine: number | null;
  anchorPath: string | null;
  line: number;
  path: string;
}

export const EMPTY_TRAIL: DefinitionRef[] = [];

function encodePath(path: string) {
  return path.replace(/[%@:|>]/g, (char) => encodeURIComponent(char));
}

function decodePath(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function parseLinePath(value: string) {
  const separator = value.indexOf(":");
  if (separator < 1) {
    return null;
  }
  const line = Number(value.slice(0, separator));
  const path = decodePath(value.slice(separator + 1));
  if (!Number.isInteger(line) || line < 1 || !path) {
    return null;
  }
  return { line, path };
}

const definitionRefParser = createParser<DefinitionRef>({
  parse: (value) => {
    const at = value.lastIndexOf("@");
    if (at > 0) {
      const anchor = parseLinePath(value.slice(at + 1));
      const target = anchor ? parseLinePath(value.slice(0, at)) : null;
      if (anchor && target) {
        return {
          line: target.line,
          path: target.path,
          anchorLine: anchor.line,
          anchorPath: anchor.path,
        };
      }
    }
    const target = parseLinePath(value);
    if (!target) {
      return null;
    }
    return {
      line: target.line,
      path: target.path,
      anchorLine: null,
      anchorPath: null,
    };
  },
  serialize: (ref) => {
    const target = `${ref.line}:${encodePath(ref.path)}`;
    if (ref.anchorLine === null || ref.anchorPath === null) {
      return target;
    }
    return `${target}@${ref.anchorLine}:${encodePath(ref.anchorPath)}`;
  },
  eq: (a, b) =>
    a.line === b.line &&
    a.path === b.path &&
    a.anchorLine === b.anchorLine &&
    a.anchorPath === b.anchorPath,
});

const pullRequestSearchParams = {
  file: parseAsString,
  line: parseAsInteger,
  panes: parseAsArrayOf(definitionRefParser, "|"),
  tab: parseAsStringLiteral(PULL_REQUEST_TABS).withDefault("diff"),
};

export function usePullRequestSearch() {
  return useQueryStates(pullRequestSearchParams);
}

export type PullRequestSearchSetter = ReturnType<
  typeof usePullRequestSearch
>[1];

export function trailKeyAt(trail: readonly DefinitionRef[], depth: number) {
  return trail
    .slice(0, depth + 1)
    .map((step) => `${step.line}:${step.path}`)
    .join(">");
}
