const STATIC_IMPORT = /(?:^|\n)\s*import\s[^"'`;]*?from\s*["']([^"']+)["']/g;
const SIDE_EFFECT_IMPORT = /(?:^|\n)\s*import\s*["']([^"']+)["']/g;
const EXPORT_FROM = /(?:^|\n)\s*export\s[^"'`;]*?from\s*["']([^"']+)["']/g;
const DYNAMIC_IMPORT = /import\(\s*["']([^"']+)["']\s*\)/g;

const SPECIFIER_PATTERNS = [
  STATIC_IMPORT,
  SIDE_EFFECT_IMPORT,
  EXPORT_FROM,
  DYNAMIC_IMPORT,
];

export function parseImportSpecifiers(content: string) {
  const specifiers = new Set<string>();
  for (const pattern of SPECIFIER_PATTERNS) {
    for (const match of content.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier) {
        specifiers.add(specifier);
      }
    }
  }
  return specifiers;
}

const EXTENSION_CANDIDATES = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const SOURCE_EXTENSION = /\.(?:m|c)?jsx?$/;

function* tailCandidates(tail: string) {
  const bases = [tail];
  if (SOURCE_EXTENSION.test(tail)) {
    bases.push(tail.replace(SOURCE_EXTENSION, ""));
  }
  for (const base of bases) {
    for (const extension of EXTENSION_CANDIDATES) {
      yield `${base}${extension}`;
    }
    for (const extension of EXTENSION_CANDIDATES.slice(1)) {
      yield `${base}/index${extension}`;
    }
  }
}

function normalize(fromDirectory: string, specifier: string) {
  const segments = fromDirectory === "" ? [] : fromDirectory.split("/");
  for (const segment of specifier.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (segments.length === 0) {
        return null;
      }
      segments.pop();
    } else {
      segments.push(segment);
    }
  }
  return segments.join("/");
}

function resolveRelative(
  fromPath: string,
  specifier: string,
  paths: ReadonlySet<string>
) {
  const directory = fromPath.slice(0, Math.max(fromPath.lastIndexOf("/"), 0));
  const tail = normalize(directory, specifier);
  if (tail === null) {
    return null;
  }
  for (const candidate of tailCandidates(tail)) {
    if (paths.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

function aliasTail(specifier: string) {
  if (specifier.startsWith("@/") || specifier.startsWith("~/")) {
    return specifier.slice(2);
  }
  const segments = specifier.split("/");
  if (specifier.startsWith("@") && segments.length > 2) {
    return segments.slice(2).join("/");
  }
  return null;
}

function resolveAliased(
  specifier: string,
  paths: ReadonlySet<string>
): string | null {
  const tail = aliasTail(specifier);
  if (!tail) {
    return null;
  }
  for (const candidate of tailCandidates(tail)) {
    const suffix = `/${candidate}`;
    const matches: string[] = [];
    for (const path of paths) {
      if (path.endsWith(suffix)) {
        matches.push(path);
      }
    }
    if (matches.length === 1) {
      return matches[0] ?? null;
    }
    if (matches.length > 1) {
      return null;
    }
  }
  return null;
}

export function resolveSpecifier(
  fromPath: string,
  specifier: string,
  paths: ReadonlySet<string>
) {
  if (specifier.startsWith(".")) {
    return resolveRelative(fromPath, specifier, paths);
  }
  return resolveAliased(specifier, paths);
}

export interface FileRelations {
  importedBy: ReadonlySet<string>;
  imports: ReadonlySet<string>;
}

interface MutableRelations {
  importedBy: Set<string>;
  imports: Set<string>;
}

export type ImportGraph = ReadonlyMap<string, FileRelations>;

export function buildImportGraph(
  sources: readonly { path: string; content: string }[],
  paths: ReadonlySet<string>
): ImportGraph {
  const graph = new Map<string, MutableRelations>();
  const relationsFor = (path: string) => {
    const existing = graph.get(path);
    if (existing) {
      return existing;
    }
    const created = {
      imports: new Set<string>(),
      importedBy: new Set<string>(),
    };
    graph.set(path, created);
    return created;
  };
  for (const { path, content } of sources) {
    for (const specifier of parseImportSpecifiers(content)) {
      const target = resolveSpecifier(path, specifier, paths);
      if (target && target !== path) {
        relationsFor(path).imports.add(target);
        relationsFor(target).importedBy.add(path);
      }
    }
  }
  return graph;
}
