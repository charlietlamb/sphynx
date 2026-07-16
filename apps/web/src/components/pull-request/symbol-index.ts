import type { PullRequestFile } from "@sphynx/schema/pull-requests";
import { walkPatchNewLines } from "@/components/pull-request/patch-lines";

type SymbolKind = "member" | "top";
type SymbolScope = "file" | "global";

interface SymbolDefinition {
  kind: SymbolKind;
  lineNumber: number;
  path: string;
  scope: SymbolScope;
}

export type SymbolIndex = ReadonlyMap<string, SymbolDefinition>;

const INDEXABLE_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const TEST_FILE = /\.(test|spec)\.[jt]sx?$|(^|\/)(tests?|__tests__)\//;

const DEFINITION_PATTERNS: readonly {
  kind: SymbolKind;
  pattern: RegExp;
}[] = [
  {
    kind: "top",
    pattern:
      /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/,
  },
  {
    kind: "top",
    pattern:
      /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/,
  },
  {
    kind: "top",
    pattern:
      /^\s*(?:export\s+)?(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::.*?)?=\s*(?:async\s+)?(?:<[^>]*>\s*)?(?:\([^)]*\)\s*(?::[^=]+)?=>|\([^)]*$|function|[A-Za-z_$][\w$]*\s*=>)/,
  },
  {
    kind: "top",
    pattern: /^\s*(?:export\s+)?(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)/,
  },
  {
    kind: "member",
    pattern:
      /^\s*(?:(?:public|private|protected|static|override|readonly|get|set|async)\s+)*\*?([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\([^)"'`]*\)\s*(?::[^{]+)?\{\s*$/,
  },
  {
    kind: "member",
    pattern:
      /^\s*(?:(?:public|private|protected|static|readonly)\s+)*([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:<[^>]*>\s*)?\([^)]*\)\s*(?::[^=]+)?=>/,
  },
];

const MIN_SYMBOL_LENGTH = 4;

const RESERVED_NAMES = new Set([
  "catch",
  "constructor",
  "return",
  "switch",
  "throw",
  "while",
  "yield",
]);

function symbolFrom(line: string) {
  for (const { kind, pattern } of DEFINITION_PATTERNS) {
    const match = pattern.exec(line);
    if (
      match?.[1] &&
      match[1].length >= MIN_SYMBOL_LENGTH &&
      !RESERVED_NAMES.has(match[1])
    ) {
      return { kind, name: match[1] };
    }
  }
  return null;
}

function collectDefinitions(
  file: PullRequestFile,
  register: (symbol: string, definition: SymbolDefinition) => void
) {
  if (!(file.patch && INDEXABLE_EXTENSIONS.test(file.path))) {
    return;
  }
  const scope: SymbolScope = TEST_FILE.test(file.path) ? "file" : "global";
  walkPatchNewLines(file.patch, (lineNumber, content) => {
    const symbol = symbolFrom(content.slice(1));
    if (symbol) {
      register(symbol.name, {
        kind: symbol.kind,
        path: file.path,
        lineNumber,
        scope,
      });
    }
  });
}

export function buildSymbolIndex(
  files: readonly PullRequestFile[]
): SymbolIndex {
  const definitions = new Map<string, SymbolDefinition>();
  const ambiguous = new Set<string>();
  for (const file of files) {
    collectDefinitions(file, (symbol, definition) => {
      const existing = definitions.get(symbol);
      if (!existing) {
        definitions.set(symbol, definition);
        return;
      }
      const isOverload =
        existing.path === definition.path &&
        existing.kind === "top" &&
        definition.kind === "top";
      if (!isOverload) {
        ambiguous.add(symbol);
      }
    });
  }
  for (const symbol of ambiguous) {
    definitions.delete(symbol);
  }
  return definitions;
}
