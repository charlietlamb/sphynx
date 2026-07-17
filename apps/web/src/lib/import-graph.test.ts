import { describe, expect, test } from "bun:test";
import {
  buildImportGraph,
  parseImportSpecifiers,
  resolveSpecifier,
} from "@/lib/import-graph";

describe("parseImportSpecifiers", () => {
  test("collects static, side-effect, export-from, and dynamic imports", () => {
    const content = [
      'import { a } from "./a";',
      'import "./styles.css";',
      "import {",
      "  b,",
      "  c,",
      '} from "../b";',
      'export { d } from "@/lib/d";',
      'const lazy = () => import("./lazy");',
      "const notAnImport = \"from './nope'\";",
    ].join("\n");
    expect(parseImportSpecifiers(content)).toEqual(
      new Set(["./a", "./styles.css", "../b", "@/lib/d", "./lazy"])
    );
  });
});

describe("resolveSpecifier", () => {
  const paths = new Set([
    "apps/web/src/lib/settings.ts",
    "apps/web/src/lib/theme/index.ts",
    "apps/web/src/components/file-list.tsx",
    "packages/ui/src/components/ui/button.tsx",
  ]);

  test("resolves relative imports with extension and index candidates", () => {
    expect(
      resolveSpecifier(
        "apps/web/src/components/file-list.tsx",
        "../lib/settings",
        paths
      )
    ).toBe("apps/web/src/lib/settings.ts");
    expect(
      resolveSpecifier(
        "apps/web/src/components/file-list.tsx",
        "../lib/theme",
        paths
      )
    ).toBe("apps/web/src/lib/theme/index.ts");
  });

  test("resolves js-style specifiers against ts sources", () => {
    expect(
      resolveSpecifier(
        "apps/web/src/components/file-list.tsx",
        "../lib/settings.js",
        paths
      )
    ).toBe("apps/web/src/lib/settings.ts");
  });

  test("resolves unique alias and scoped package imports", () => {
    expect(
      resolveSpecifier("apps/web/src/lib/settings.ts", "@/lib/theme", paths)
    ).toBe("apps/web/src/lib/theme/index.ts");
    expect(
      resolveSpecifier(
        "apps/web/src/lib/settings.ts",
        "@sphynx/ui/components/ui/button",
        paths
      )
    ).toBe("packages/ui/src/components/ui/button.tsx");
  });

  test("skips bare packages, escapes, and ambiguous matches", () => {
    expect(
      resolveSpecifier("apps/web/src/lib/settings.ts", "react", paths)
    ).toBeNull();
    expect(resolveSpecifier("a.ts", "../../outside", paths)).toBeNull();
    const ambiguous = new Set([
      "apps/web/src/lib/util.ts",
      "apps/server/src/lib/util.ts",
    ]);
    expect(resolveSpecifier("x.ts", "@/lib/util", ambiguous)).toBeNull();
  });
});

describe("buildImportGraph", () => {
  test("builds bidirectional edges among changed files only", () => {
    const paths = new Set([
      "src/a.ts",
      "src/b.ts",
      "src/c.ts",
      "src/unrelated.ts",
    ]);
    const graph = buildImportGraph(
      [
        {
          path: "src/a.ts",
          content: 'import { b } from "./b";\nimport out from "./missing";',
        },
        { path: "src/c.ts", content: 'import { b } from "./b";' },
        { path: "src/b.ts", content: "export const b = 1;" },
      ],
      paths
    );
    expect(graph.get("src/a.ts")?.imports).toEqual(new Set(["src/b.ts"]));
    expect(graph.get("src/b.ts")?.importedBy).toEqual(
      new Set(["src/a.ts", "src/c.ts"])
    );
    expect(graph.get("src/unrelated.ts")).toBeUndefined();
  });
});
