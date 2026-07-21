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

export function pullScores(pull: QueuePull): ScoreSummary[] {
  const scored: { at: string; summary: ScoreSummary }[] = [];
  for (const reviewer of pull.reviewers) {
    if (!reviewer.score) {
      continue;
    }
    const [value, scale] = reviewer.score.split("/").map(Number);
    if (!(value !== undefined && scale)) {
      continue;
    }
    scored.push({
      at: reviewer.submittedAt,
      summary: {
        label: reviewer.score,
        ratio: value / scale,
        reviewer: reviewer.name,
      },
    });
  }
  return scored
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((entry) => entry.summary);
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

export const QUEUE_FILTERS = [
  { label: "All", value: "all" },
  { label: "Needs review", value: "needs-eyes" },
  { label: "Ready", value: "ready" },
  { label: "Blocked", value: "contested" },
] as const;

export type QueueFilter = (typeof QUEUE_FILTERS)[number]["value"];

function flattenMatches(
  nodes: readonly StackNode[],
  match: (pull: QueuePull) => boolean
): StackNode[] {
  const kept: StackNode[] = [];
  for (const node of nodes) {
    const children = flattenMatches(node.children, match);
    if (match(node.pull)) {
      kept.push({ pull: node.pull, children });
    } else {
      kept.push(...children);
    }
  }
  return kept;
}

export function filterQueue(
  queue: BranchQueue,
  branch: string | null,
  filter: QueueFilter = "all"
): BranchQueue {
  const scoped = branch
    ? queue.groups.filter((group) => group.branch === branch)
    : queue.groups;
  if (filter === "all") {
    return branch ? { groups: scoped, order: collectOrder(scoped) } : queue;
  }
  const groups: BranchGroup[] = [];
  for (const group of scoped) {
    const nodes = flattenMatches(
      group.nodes,
      (pull) => pull.decision === filter
    );
    if (nodes.length > 0) {
      groups.push({ ...group, nodes, ...countNodes(nodes) });
    }
  }
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
  const stageSet = new Set(flow.stages);
  const heads = new Map<string, QueuePull>();
  for (const pull of flow.openPulls) {
    heads.set(pull.headRefName, pull);
  }
  const roots: QueuePull[] = [];
  const childrenByBase = new Map<string, QueuePull[]>();
  for (const pull of flow.openPulls) {
    /**
     * A pull stacks onto a parent only when its base is that parent's head AND
     * the base is not a flow stage. Stage branches (dev, main, production) are
     * the trunk: a PR targeting `dev` groups under `dev`, even though `dev` is
     * also the head of the `dev -> main` promotion — otherwise it would be
     * nested under that promotion and the `dev` group would read as empty.
     */
    const parent = heads.get(pull.baseRefName);
    if (
      parent &&
      parent.number !== pull.number &&
      !stageSet.has(pull.baseRefName)
    ) {
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
