import { describe, expect, test } from "bun:test";
import type { PullRequestFile } from "@sphynx/schema/pull-requests";
import { buildFileTree, type FileTreeNode } from "@/lib/file-tree";

const file = (path: string) => ({ path }) as PullRequestFile;

function flattenFiles(nodes: FileTreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.type === "file" ? [node.file.path] : flattenFiles(node.children)
  );
}

describe("buildFileTree", () => {
  test("compresses single-child directory chains into one node", () => {
    const tree = buildFileTree([
      file("server/tests/scenarios/licenses/pagination.ts"),
      file("server/tests/scenarios/licenses/extras.ts"),
    ]);
    expect(tree).toHaveLength(1);
    const directory = tree[0];
    if (directory?.type !== "directory") {
      throw new Error("expected directory");
    }
    expect(directory.label).toBe("server/tests/scenarios/licenses");
    expect(directory.key).toBe("server/tests/scenarios/licenses");
    expect(directory.children).toHaveLength(2);
  });

  test("keeps sibling directories separate with correct depths", () => {
    const tree = buildFileTree([
      file("app/components/a.tsx"),
      file("app/components/nested/b.tsx"),
      file("app/lib/c.ts"),
    ]);
    const app = tree[0];
    if (app?.type !== "directory") {
      throw new Error("expected directory");
    }
    expect(app.label).toBe("app");
    const [components, lib] = app.children;
    if (components?.type !== "directory" || lib?.type !== "directory") {
      throw new Error("expected directories");
    }
    expect(components.label).toBe("components");
    expect(components.depth).toBe(1);
    const nested = components.children[1];
    if (nested?.type !== "directory") {
      throw new Error("expected nested directory");
    }
    expect(nested.label).toBe("nested");
    expect(nested.key).toBe("app/components/nested");
    expect(nested.depth).toBe(2);
    expect(lib.label).toBe("lib");
  });

  test("preserves the incoming file order in depth-first traversal", () => {
    const paths = [
      "a.ts",
      "app/components/a.tsx",
      "app/components/b.tsx",
      "app/lib/c.ts",
      "readme.md",
      "zed/d.ts",
    ];
    const tree = buildFileTree(paths.map(file));
    expect(flattenFiles(tree)).toEqual(paths);
  });

  test("puts root files at depth zero without a directory node", () => {
    const tree = buildFileTree([file("package.json")]);
    expect(tree).toEqual([
      { type: "file", file: file("package.json"), depth: 0 },
    ]);
  });
});
