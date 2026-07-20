import type {
  SymbolDefinition,
  SymbolIndexPayload,
} from "@sphynx/schema/pull-requests";

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

type SymbolKind = SymbolDefinition["kind"];
type SymbolScope = SymbolDefinition["scope"];

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
  path: string,
  patch: string,
  register: (symbol: string, definition: SymbolDefinition) => void
) {
  if (!INDEXABLE_EXTENSIONS.test(path)) {
    return;
  }
  const scope: SymbolScope = TEST_FILE.test(path) ? "file" : "global";
  walkPatchNewLines(patch, (lineNumber, content) => {
    const symbol = symbolFrom(content.slice(1));
    if (symbol) {
      register(symbol.name, {
        kind: symbol.kind,
        path,
        lineNumber,
        scope,
      });
    }
  });
}

/**
 * Maps each unambiguous symbol in the diff to where it is defined. Symbols
 * defined in more than one file are dropped, so this needs every patch in the
 * pull request — which is why it is built here rather than on the client.
 */
export function buildSymbolIndex(
  patches: ReadonlyMap<string, string>
): SymbolIndexPayload {
  const definitions = new Map<string, SymbolDefinition>();
  const ambiguous = new Set<string>();
  for (const [path, patch] of patches) {
    collectDefinitions(path, patch, (symbol, definition) => {
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
  return Object.assign(Object.create(null), Object.fromEntries(definitions));
}
