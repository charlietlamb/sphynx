import type { PullRequestFile } from "@sphynx/schema/pull-requests";

interface FileTreeDirectory {
  children: FileTreeNode[];
  depth: number;
  key: string;
  label: string;
  type: "directory";
}

interface FileTreeLeaf {
  depth: number;
  file: PullRequestFile;
  type: "file";
}

export type FileTreeNode = FileTreeDirectory | FileTreeLeaf;

interface TrieDirectory {
  children: (TrieDirectory | PullRequestFile)[];
  directories: Map<string, TrieDirectory>;
  name: string;
}

const isDirectory = (
  child: TrieDirectory | PullRequestFile
): child is TrieDirectory => "children" in child;

function childDirectory(parent: TrieDirectory, name: string) {
  const existing = parent.directories.get(name);
  if (existing) {
    return existing;
  }
  const created: TrieDirectory = {
    name,
    directories: new Map(),
    children: [],
  };
  parent.directories.set(name, created);
  parent.children.push(created);
  return created;
}

function insert(root: TrieDirectory, file: PullRequestFile) {
  const segments = file.path.split("/");
  let node = root;
  for (const segment of segments.slice(0, -1)) {
    node = childDirectory(node, segment);
  }
  node.children.push(file);
}

function compressChain(directory: TrieDirectory) {
  let label = directory.name;
  let current = directory;
  while (current.children.length === 1) {
    const only = current.children[0];
    if (!(only && isDirectory(only))) {
      break;
    }
    label = `${label}/${only.name}`;
    current = only;
  }
  return { label, current };
}

function toNodes(
  parent: TrieDirectory,
  prefix: string,
  depth: number
): FileTreeNode[] {
  return parent.children.map((child) => {
    if (!isDirectory(child)) {
      return { type: "file", file: child, depth };
    }
    const { label, current } = compressChain(child);
    const key = prefix === "" ? label : `${prefix}/${label}`;
    return {
      type: "directory",
      key,
      label,
      depth,
      children: toNodes(current, key, depth + 1),
    };
  });
}

export function buildFileTree(files: readonly PullRequestFile[]) {
  const root: TrieDirectory = {
    name: "",
    directories: new Map(),
    children: [],
  };
  for (const file of files) {
    insert(root, file);
  }
  return toNodes(root, "", 0);
}
