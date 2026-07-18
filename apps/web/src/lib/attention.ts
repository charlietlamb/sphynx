import type { QueuePull, RepoFlow } from "@sphynx/schema/review-queue";

export type SizeClass = "xs" | "s" | "m" | "l" | "xl";

const SIZE_STEPS: readonly [number, SizeClass][] = [
  [50, "xs"],
  [200, "s"],
  [600, "m"],
  [1500, "l"],
];

export function sizeClass(pull: QueuePull): SizeClass {
  const total = pull.additions + pull.deletions;
  for (const [limit, size] of SIZE_STEPS) {
    if (total < limit) {
      return size;
    }
  }
  return "xl";
}

export function pullKey(pull: QueuePull) {
  return `${pull.owner}/${pull.repo}#${pull.number}`;
}

export function repoKeyOf(entry: { owner: string; repo: string }) {
  return `${entry.owner}/${entry.repo}`;
}

export function isMergeable(pull: QueuePull) {
  return !pull.isDraft && pull.decision === "ready";
}

export function isContested(pull: QueuePull) {
  return !pull.isDraft && pull.decision === "contested";
}

export interface ScoreSummary {
  label: string;
  ratio: number;
  reviewer: string;
}

export function worstScore(pull: QueuePull): ScoreSummary | null {
  let worst: ScoreSummary | null = null;
  for (const reviewer of pull.reviewers) {
    if (!reviewer.score) {
      continue;
    }
    const [value, scale] = reviewer.score.split("/").map(Number);
    if (!(value !== undefined && scale)) {
      continue;
    }
    const ratio = value / scale;
    if (worst === null || ratio < worst.ratio) {
      worst = { label: reviewer.score, ratio, reviewer: reviewer.name };
    }
  }
  return worst;
}

export interface StackNode {
  children: StackNode[];
  pull: QueuePull;
}

export interface BranchGroup {
  branch: string;
  contested: number;
  isStage: boolean;
  mergeable: number;
  nodes: StackNode[];
  total: number;
}

export interface BranchQueue {
  groups: BranchGroup[];
  order: string[];
}

const DECISION_RANK: Record<QueuePull["decision"], number> = {
  contested: 0,
  ready: 1,
  "needs-eyes": 2,
  draft: 3,
};

function rankOf(pull: QueuePull) {
  return pull.isDraft ? DECISION_RANK.draft : DECISION_RANK[pull.decision];
}

function byAttention(a: QueuePull, b: QueuePull) {
  const rank = rankOf(a) - rankOf(b);
  if (rank !== 0) {
    return rank;
  }
  return b.updatedAt.localeCompare(a.updatedAt);
}

function buildNode(
  pull: QueuePull,
  childrenByBase: Map<string, QueuePull[]>
): StackNode {
  const children = (childrenByBase.get(pull.headRefName) ?? [])
    .sort(byAttention)
    .map((child) => buildNode(child, childrenByBase));
  return { pull, children };
}

function countNodes(nodes: readonly StackNode[]) {
  let total = 0;
  let mergeable = 0;
  let contested = 0;
  const walk = (list: readonly StackNode[]) => {
    for (const node of list) {
      total += 1;
      if (isMergeable(node.pull)) {
        mergeable += 1;
      }
      if (isContested(node.pull)) {
        contested += 1;
      }
      walk(node.children);
    }
  };
  walk(nodes);
  return { total, mergeable, contested };
}

function collectOrder(groups: readonly BranchGroup[]): string[] {
  const order: string[] = [];
  const walk = (nodes: readonly StackNode[]) => {
    for (const node of nodes) {
      order.push(pullKey(node.pull));
      walk(node.children);
    }
  };
  for (const group of groups) {
    walk(group.nodes);
  }
  return order;
}

export function filterQueue(
  queue: BranchQueue,
  branch: string | null
): BranchQueue {
  if (!branch) {
    return queue;
  }
  const groups = queue.groups.filter((group) => group.branch === branch);
  return { groups, order: collectOrder(groups) };
}

export interface RailBranchItem {
  branch: string;
  contested: number;
  isStage: boolean;
  mergeable: number;
  total: number;
}

export function railBranches(
  flow: RepoFlow,
  queue: BranchQueue
): RailBranchItem[] {
  const byBranch = new Map(queue.groups.map((group) => [group.branch, group]));
  const stageSet = new Set(flow.stages);
  const items: RailBranchItem[] = flow.stages.map((stage) => {
    const group = byBranch.get(stage);
    return {
      branch: stage,
      isStage: true,
      total: group?.total ?? 0,
      mergeable: group?.mergeable ?? 0,
      contested: group?.contested ?? 0,
    };
  });
  for (const group of queue.groups) {
    if (!stageSet.has(group.branch)) {
      items.push({
        branch: group.branch,
        isStage: false,
        total: group.total,
        mergeable: group.mergeable,
        contested: group.contested,
      });
    }
  }
  return items;
}

export function buildBranchQueue(flow: RepoFlow): BranchQueue {
  const heads = new Map<string, QueuePull>();
  for (const pull of flow.openPulls) {
    heads.set(pull.headRefName, pull);
  }
  const roots: QueuePull[] = [];
  const childrenByBase = new Map<string, QueuePull[]>();
  for (const pull of flow.openPulls) {
    const parent = heads.get(pull.baseRefName);
    if (parent && parent.number !== pull.number) {
      const siblings = childrenByBase.get(pull.baseRefName) ?? [];
      siblings.push(pull);
      childrenByBase.set(pull.baseRefName, siblings);
    } else {
      roots.push(pull);
    }
  }

  const rootsByBase = new Map<string, QueuePull[]>();
  for (const pull of roots) {
    const list = rootsByBase.get(pull.baseRefName) ?? [];
    list.push(pull);
    rootsByBase.set(pull.baseRefName, list);
  }

  const stageSet = new Set(flow.stages);
  const branches = [
    ...flow.stages.filter((stage) => rootsByBase.has(stage)),
    ...[...rootsByBase.keys()]
      .filter((base) => !stageSet.has(base))
      .sort(
        (a, b) =>
          (rootsByBase.get(b)?.length ?? 0) - (rootsByBase.get(a)?.length ?? 0)
      ),
  ];

  const groups: BranchGroup[] = branches.map((branch) => {
    const nodes = (rootsByBase.get(branch) ?? [])
      .sort(byAttention)
      .map((pull) => buildNode(pull, childrenByBase));
    const counts = countNodes(nodes);
    return {
      branch,
      isStage: stageSet.has(branch),
      nodes,
      total: counts.total,
      mergeable: counts.mergeable,
      contested: counts.contested,
    };
  });

  return { groups, order: collectOrder(groups) };
}
