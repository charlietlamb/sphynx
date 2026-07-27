import type { GitHubUser } from "@sphynx/schema/pull-requests";
import type { QueuePull, RepoFlow } from "@sphynx/schema/review-queue";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { BlockPullDialog } from "@/components/dashboard/block-pull-dialog";
import { DialogProvider } from "@/components/dashboard/dashboard-dialogs";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DossierPane } from "@/components/dashboard/dossier-pane";
import { FlowRail } from "@/components/dashboard/flow-rail";
import { MergePullDialog } from "@/components/dashboard/merge-pull-dialog";
import { QueuePane } from "@/components/dashboard/queue-pane";
import { buildBranchQueue, railBranches } from "@/lib/attention";
import { devOnly } from "@/lib/dev-only";

const REGISTRY = {
  blockPull: BlockPullDialog,
  mergePull: MergePullDialog,
};

export const Route = createFileRoute("/dev/dashboard")({
  beforeLoad: devOnly,
  component: DevDashboard,
});

const NOW = 1_785_000_000_000;

const noop = () => undefined;

function user(login: string): GitHubUser {
  return { login, avatarUrl: `https://github.com/${login}.png?size=40` };
}

const BOT = user("dependabot[bot]");
const CHARLIE = user("charlietlamb");

function pull(over: Partial<QueuePull> & Pick<QueuePull, "number" | "title">) {
  const base = {
    owner: "useautumn",
    repo: "autumn",
    hasBody: true,
    author: BOT,
    isDraft: false,
    state: "open",
    mergedAt: null,
    updatedAt: new Date(NOW - 2 * 86_400_000).toISOString(),
    additions: 40,
    deletions: 12,
    changedFiles: 2,
    ci: "failure",
    headRefName: "deps/js-yaml",
    baseRefName: "dev",
    reviewers: [],
    reviewerCount: 0,
    botReviewerCount: 0,
    approvals: 0,
    changesRequested: 0,
    unresolvedThreads: 0,
    ciFailures: [{ name: "Check for unused code", url: null }],
    ciCounts: { failed: 1, passed: 4, pending: 0 },
    threadPreviews: [],
    decision: "needs-eyes",
    blocker: "Fix failing checks",
    ...over,
  } satisfies QueuePull;
  return base;
}

const PULLS: QueuePull[] = [
  pull({
    number: 2401,
    title:
      "chore(deps): bump js-yaml, eslint and typescript-eslint in /packages/sdk",
  }),
  pull({
    number: 2402,
    title: "chore(deps): bump next from 16.1.6 to 16.2.11 in /apps/site",
    ci: "none",
    ciFailures: [],
    blocker: null,
    decision: "ready",
  }),
  pull({
    number: 2392,
    title: "chore(deps): bump hono from 4.12.7 to 4.12.27 in /server",
    ci: "success",
    ciFailures: [],
    blocker: null,
    decision: "ready",
  }),
  pull({
    number: 2364,
    title: "route Axiom logs through FireLens",
    author: CHARLIE,
    ci: "success",
    ciFailures: [],
    blocker: null,
    decision: "ready",
    additions: 210,
    deletions: 44,
    changedFiles: 6,
    reviewers: [
      {
        name: "cubic-dev-ai",
        kind: "bot",
        avatarUrl: null,
        state: "changes-requested",
        score: "2/5",
        submittedAt: new Date(NOW - 4 * 86_400_000).toISOString(),
      },
    ],
    reviewerCount: 1,
    unresolvedThreads: 2,
    threadPreviews: [
      {
        author: user("cubic-dev-ai"),
        body: "P1 The schedule is committed before the parallel customer-product updates.",
        id: "t1",
        path: "server/src/transferRelatedCustomerProducts.ts",
        rootCommentId: 1,
      },
    ],
  }),
  pull({
    number: 2342,
    title: "fix(billing): correct proration amounts for zero-dollar plans",
    author: CHARLIE,
    ci: "success",
    ciFailures: [],
    blocker: null,
    decision: "contested",
  }),
  ...Array.from({ length: 45 }, (_, index) =>
    pull({
      number: 2300 - index,
      title: `chore(deps): bump package-${index} in /packages to fill the queue`,
      ci: index % 2 === 0 ? "success" : "failure",
      ciFailures: index % 2 === 0 ? [] : [{ name: "Check", url: null }],
      blocker: index % 2 === 0 ? null : "Fix failing checks",
      decision: index % 2 === 0 ? "ready" : "needs-eyes",
    })
  ),
];

const FLOW: RepoFlow = {
  owner: "useautumn",
  repo: "autumn",
  stages: ["dev", "main"],
  openPulls: PULLS,
  gaps: [],
};

function DevDashboard() {
  const searchInput = useRef<HTMLInputElement>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState<string | null>(null);

  const queue = useMemo(() => buildBranchQueue(FLOW), []);
  const rail = useMemo(() => railBranches(FLOW, queue), [queue]);
  const focusedPull =
    PULLS.find((p) => `${p.owner}/${p.repo}#${p.number}` === focusedKey) ??
    PULLS[0];

  return (
    <DialogProvider registry={REGISTRY}>
      <DashboardShell
        dossier={
          <DossierPane
            canAct={true}
            installationId={null}
            now={NOW}
            onOpen={noop}
            pull={focusedPull}
          />
        }
        githubUrl="https://github.com/useautumn/autumn"
        queue={
          <QueuePane
            allRepos={false}
            filter="all"
            focusedKey={focusedKey}
            now={NOW}
            onFilter={noop}
            onFocus={setFocusedKey}
            onOpen={noop}
            onSearch={noop}
            onToggleRepos={noop}
            queue={queue}
            search={{
              active: false,
              isError: false,
              isPending: false,
              pulls: [],
              totalCount: 0,
            }}
            searchInput={searchInput}
            searchQuery=""
          />
        }
        rail={
          <FlowRail
            canAct={true}
            flow={FLOW}
            items={rail}
            now={NOW}
            onOpenNumber={noop}
            onSelect={setBranchFilter}
            selected={branchFilter}
          />
        }
        switcher={
          <span className="text-[13px] text-muted-foreground">
            useautumn <span className="text-muted-foreground/40">/</span> autumn
          </span>
        }
      />
    </DialogProvider>
  );
}
