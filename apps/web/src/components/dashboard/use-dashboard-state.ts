import type { QueuePull, RepoFlow } from "@sphynx/schema/review-queue";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDialog } from "@/components/dashboard/dashboard-dialogs";
import {
  type PendingMerges,
  withoutMerged,
} from "@/components/dashboard/pending-merges";
import {
  reconcilePendingMerges,
  usePendingMerges,
} from "@/components/dashboard/pending-merges-store";
import type { RepoOption } from "@/components/dashboard/repo-switcher";
import { useDashboardKeys } from "@/components/dashboard/use-dashboard-keys";
import { useInstallations } from "@/components/dashboard/use-installations";
import {
  toRepoOption,
  usePipeline,
  useQueue,
  useRepoFlow,
} from "@/components/dashboard/use-pipeline";
import { usePullSearch } from "@/components/dashboard/use-pull-search";
import { useSettings } from "@/components/settings/settings-provider";
import { useWorkbench } from "@/components/workbench/use-workbench";
import {
  buildBranchQueue,
  filterQueue,
  pullKey,
  type QueueFilter,
  railBranches,
  repoKeyOf,
} from "@/lib/attention";
import { useSession } from "@/lib/auth-client";
import { asPipeline, asQueuePulls } from "@/lib/read-model";

function cycle(index: number, delta: number, length: number) {
  return (index + delta + length) % length;
}

/** The focused pull key: the current one if still in view, else the first. */
function resolveFocus(focusedKey: string | null, order: readonly string[]) {
  if (focusedKey && order.includes(focusedKey)) {
    return focusedKey;
  }
  return order[0] ?? null;
}

/**
 * The repo flows to show, busiest first: the full pipeline once it lands, else
 * the lighter queue with empty stages/gaps so the list paints before the rail.
 * Tombstoned (just-merged) pulls are filtered out, and repos with no open pulls
 * are dropped.
 */
function buildFlows(
  pipelineData: { repos: readonly RepoFlow[] } | undefined,
  queueData: { repos: readonly RepoFlow[] } | undefined,
  pendingMerges: PendingMerges
): readonly RepoFlow[] {
  const full = pipelineData
    ? withoutMerged(pipelineData, pendingMerges).repos
    : undefined;
  const queued = queueData ? withoutMerged(queueData, pendingMerges).repos : [];
  const source: readonly RepoFlow[] =
    full ?? queued.map((flow) => ({ ...flow, stages: [], gaps: [] }));
  return source
    .filter((flow) => flow.openPulls.length > 0)
    .sort((a, b) => b.openPulls.length - a.openPulls.length);
}

/**
 * The repo flow to render: the pipeline's own flow when the selected repo has
 * open pulls, a minimal flow built from the on-demand pulls for a quiet repo, or
 * the busiest repo as a fallback.
 */
function selectFlow(
  pipelineFlow: RepoFlow | null,
  quietRepo: RepoOption | null,
  quietPulls: unknown,
  flows: readonly RepoFlow[]
): RepoFlow | null {
  if (pipelineFlow) {
    return pipelineFlow;
  }
  if (quietRepo) {
    return {
      owner: quietRepo.owner,
      repo: quietRepo.repo,
      stages: [],
      openPulls: asQueuePulls(quietPulls),
      gaps: [],
    };
  }
  return flows[0] ?? null;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the dashboard composition root wires ~10 hooks and derives the view state; pure logic is already extracted into buildFlows/selectFlow/resolveFocus and splitting further would fragment cohesive state.
export function useDashboardState() {
  const navigate = useNavigate();
  const { data: session, isPending: sessionPending } = useSession();
  const authed = Boolean(session?.user);
  const { settings, update: updateSettings } = useSettings();
  const repoKey = settings.selectedRepo;

  const orgs = useInstallations(settings.selectedInstallation, authed);
  /**
   * Drive the reads off the cookie's installation id the moment the session is
   * ready, without waiting on `useInstallations` — that endpoint makes a live
   * GitHub call to list installations, which would gate the (instant, Neon)
   * dashboard reads behind a GitHub round-trip. The server revalidates the id
   * and falls back if it is stale, so an out-of-date cookie is safe.
   * `useInstallations` still resolves in parallel to populate the org switcher.
   */
  const installationId =
    settings.selectedInstallation ?? orgs.active?.id ?? null;
  const ready = authed && !sessionPending && installationId !== null;
  const settled = authed && !(sessionPending || orgs.isPending);
  /** Signed in, installations resolved, but the App is on no organization. */
  const needsInstall = settled && !orgs.isError && orgs.active === null;
  /**
   * The lookup itself failed — usually a stale GitHub token from before the
   * App migration. Signing in again re-issues it.
   */
  const needsReauth = settled && orgs.isError;

  const queue0 = useQueue(installationId, ready);
  const pipeline = usePipeline(installationId, ready);
  const pendingMerges = usePendingMerges();

  /**
   * Convex return types are structurally identical to the schema but deeply
   * readonly. Narrow to the mutable schema shapes once at the hook boundary so
   * downstream helpers keep their existing signatures.
   */
  const pipelineData = pipeline.data ? asPipeline(pipeline.data) : undefined;
  const queueData = queue0.data ? asPipeline(queue0.data) : undefined;

  /**
   * A merge is confirmed by GitHub before its webhook materializes into the
   * read model, so a refetch in that ~1s window returns the pull as still open.
   * Retire each tombstone as soon as the freshest read no longer carries the
   * pull, so it suppresses the pull for exactly the stale window and no longer.
   */
  useEffect(() => {
    const latest = pipelineData ?? queueData;
    if (latest) {
      reconcilePendingMerges(latest);
    }
  }, [pipelineData, queueData]);
  const dialogs = useDialog();
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [allRepos, setAllRepos] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);

  /**
   * The queue arrives well before the promotion rail, so it renders first with
   * empty stages and gaps. Once the full pipeline lands it replaces this, and
   * the rail fills in without the queue ever having been blocked on it.
   */
  const flows = useMemo(
    () => buildFlows(pipelineData, queueData, pendingMerges),
    [pipelineData, queueData, pendingMerges]
  );

  /**
   * The pipeline is the source of repos: every flow with open pulls becomes a
   * switcher entry, live counts included, busiest first. Quiet repos (no open
   * pulls) are omitted — they reappear the moment a pull lands.
   */
  const repos = useMemo<RepoOption[]>(() => flows.map(toRepoOption), [flows]);

  const pipelineFlow = useMemo(
    () => flows.find((candidate) => repoKeyOf(candidate) === repoKey) ?? null,
    [flows, repoKey]
  );

  /**
   * A quiet repo the user picked has no flow in the installation pipeline yet.
   * Fetch just that repo on demand so it renders immediately instead of showing
   * an empty pipeline until the next reconcile. Only quiet selections that name
   * an accessible repo trigger this — an unknown key falls back to the busiest.
   */
  const quietRepo = useMemo(() => {
    if (pipelineFlow) {
      return null;
    }
    return repos.find((option) => option.key === repoKey) ?? null;
  }, [pipelineFlow, repos, repoKey]);

  const repoFlowQuery = useRepoFlow(
    installationId,
    quietRepo?.owner ?? null,
    quietRepo?.repo ?? null,
    ready
  );

  const flow = useMemo<RepoFlow | null>(
    () => selectFlow(pipelineFlow, quietRepo, repoFlowQuery.data ?? [], flows),
    [pipelineFlow, quietRepo, repoFlowQuery.data, flows]
  );

  const fullQueue = useMemo(
    () => (flow ? buildBranchQueue(flow) : null),
    [flow]
  );

  const queue = useMemo(
    () =>
      fullQueue ? filterQueue(fullQueue, branchFilter, queueFilter) : null,
    [fullQueue, branchFilter, queueFilter]
  );

  const rail = useMemo(
    () => (flow && fullQueue ? railBranches(flow, fullQueue) : []),
    [flow, fullQueue]
  );

  const scopedQuery = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length === 0) {
      return "";
    }
    const scope = allRepos || !flow ? "" : `repo:${flow.owner}/${flow.repo} `;
    return `${scope}is:pr ${trimmed}`;
  }, [searchQuery, allRepos, flow]);

  const search = usePullSearch(scopedQuery, installationId);

  const searchOrder = useMemo(() => search.pulls.map(pullKey), [search.pulls]);

  const pullTitles = useMemo(() => {
    const titles = new Map(
      (flow?.openPulls ?? []).map((pull) => [pull.number, pull.title])
    );
    for (const gap of flow?.gaps ?? []) {
      for (const pull of gap.pulls) {
        titles.set(pull.number, pull.title);
      }
    }
    return titles;
  }, [flow]);

  const workbench = useWorkbench(
    flow?.owner ?? null,
    flow?.repo ?? null,
    installationId,
    pullTitles
  );

  const order = search.active ? searchOrder : (queue?.order ?? []);

  const focused = resolveFocus(focusedKey, order);

  const focusedPull =
    (search.active ? search.pulls : (flow?.openPulls ?? [])).find(
      (pull) => pullKey(pull) === focused
    ) ?? null;

  const moveFocus = (delta: number) => {
    if (order.length === 0) {
      return;
    }
    const index = focused ? order.indexOf(focused) : 0;
    setFocusedKey(order[cycle(index, delta, order.length)] ?? null);
  };

  const selectInstallation = (id: number) => {
    updateSettings({ selectedInstallation: id });
    setFocusedKey(null);
    setBranchFilter(null);
  };

  const selectRepo = (key: string) => {
    updateSettings({ selectedRepo: key });
    setFocusedKey(null);
    setBranchFilter(null);
  };

  const selectBranch = (branch: string | null) => {
    setBranchFilter(branch);
    setFocusedKey(null);
  };

  const selectQueueFilter = (next: QueueFilter) => {
    setQueueFilter(next);
    setFocusedKey(null);
  };

  const changeSearch = (next: string) => {
    setSearchQuery(next);
    setFocusedKey(null);
  };

  const toggleAllRepos = () => {
    setAllRepos((previous) => !previous);
    setFocusedKey(null);
  };

  const moveRepo = (delta: number) => {
    if (!flow || flows.length === 0) {
      return;
    }
    const index = flows.findIndex(
      (candidate) => repoKeyOf(candidate) === repoKeyOf(flow)
    );
    const next = flows[cycle(index, delta, flows.length)];
    if (next) {
      selectRepo(repoKeyOf(next));
    }
  };

  const openPull = (pull: QueuePull) => {
    navigate({
      to: "/$owner/$repo/pull/$number",
      params: { owner: pull.owner, repo: pull.repo, number: pull.number },
    });
  };

  const openPullNumber = (number: number) => {
    if (flow) {
      navigate({
        to: "/$owner/$repo/pull/$number",
        params: { owner: flow.owner, repo: flow.repo, number },
      });
    }
  };

  const canActOnFocused = authed && focusedPull?.state === "open";

  useDashboardKeys({
    active: dialogs.stack.length === 0 && !workbench.open,
    onMerge: () => {
      if (canActOnFocused) {
        dialogs.open("mergePull", { pull: focusedPull });
      }
    },
    onBlock: () => {
      if (canActOnFocused) {
        dialogs.open("blockPull", { pull: focusedPull });
      }
    },
    onBranch: (index) => {
      const item = rail[index];
      if (item) {
        selectBranch(branchFilter === item.branch ? null : item.branch);
      }
    },
    onDown: () => moveFocus(1),
    onUp: () => moveFocus(-1),
    onOpen: () => {
      if (focusedPull) {
        openPull(focusedPull);
      }
    },
    onNextRepo: () => moveRepo(1),
    onPrevRepo: () => moveRepo(-1),
    onSearch: () => searchInput.current?.focus(),
    onWorkbench: () => workbench.toggle(),
  });

  const flowKey = flow ? repoKeyOf(flow) : null;
  const selectedRepo =
    repos.find((option) => option.key === repoKey) ??
    repos.find((option) => option.key === flowKey) ??
    null;

  return {
    allRepos,
    authed,
    changeSearch,
    search,
    searchInput,
    searchQuery,
    selectedRepo,
    toggleAllRepos,
    workbench,
    branchFilter,
    flow,
    focused,
    focusedPull,
    openPull,
    openPullNumber,
    queue,
    queueFilter,
    rail,
    repos,
    installationId,
    installations: orgs.installations,
    activeInstallation: orgs.active,
    needsInstall,
    needsReauth,
    selectInstallation,
    selectBranch,
    selectQueueFilter,
    selectRepo,
    setFocusedKey,
  };
}
