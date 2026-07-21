import type { QueuePull, RepoFlow } from "@sphynx/schema/review-queue";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDialog } from "@/components/dashboard/dashboard-dialogs";
import { withoutMerged } from "@/components/dashboard/pending-merges";
import {
  reconcilePendingMerges,
  usePendingMerges,
} from "@/components/dashboard/pending-merges-store";
import { useDashboardKeys } from "@/components/dashboard/use-dashboard-keys";
import { useInstallations } from "@/components/dashboard/use-installations";
import {
  toRepoOption,
  usePipeline,
  useQueue,
} from "@/components/dashboard/use-pipeline";
import { usePullSearch } from "@/components/dashboard/use-pull-search";
import { useReadModelStream } from "@/components/dashboard/use-read-model-stream";
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

function cycle(index: number, delta: number, length: number) {
  return (index + delta + length) % length;
}

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
  useReadModelStream(installationId, ready);
  const pendingMerges = usePendingMerges();

  /**
   * A merge is confirmed by GitHub before its webhook materializes into the
   * read model, so a refetch in that ~1s window returns the pull as still open.
   * Retire each tombstone as soon as the freshest read no longer carries the
   * pull, so it suppresses the pull for exactly the stale window and no longer.
   */
  useEffect(() => {
    const latest = pipeline.data ?? queue0.data;
    if (latest) {
      reconcilePendingMerges(latest);
    }
  }, [pipeline.data, queue0.data]);
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
  const flows = useMemo(() => {
    const full = pipeline.data
      ? withoutMerged(pipeline.data, pendingMerges).repos
      : undefined;
    const queued = queue0.data
      ? withoutMerged(queue0.data, pendingMerges).repos
      : [];
    const source: readonly RepoFlow[] =
      full ??
      queued.map((flow) => ({
        ...flow,
        stages: [],
        gaps: [],
      }));
    const active = source.filter((flow) => flow.openPulls.length > 0);
    return [...active].sort((a, b) => b.openPulls.length - a.openPulls.length);
  }, [pipeline.data, queue0.data, pendingMerges]);

  const repos = useMemo(() => flows.map(toRepoOption), [flows]);

  const flow = useMemo(
    () =>
      flows.find((candidate) => repoKeyOf(candidate) === repoKey) ??
      flows[0] ??
      null,
    [flows, repoKey]
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

  const focused = (() => {
    if (focusedKey && order.includes(focusedKey)) {
      return focusedKey;
    }
    return order[0] ?? null;
  })();

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
    updateSettings({ selectedRepo: `${key}` });
    setFocusedKey(null);
    setBranchFilter(null);
  };

  const selectBranch = (branch: string | null) => {
    setBranchFilter(branch ? `${branch}` : null);
    setFocusedKey(null);
  };

  const selectQueueFilter = (next: QueueFilter) => {
    setQueueFilter(`${next}` as QueueFilter);
    setFocusedKey(null);
  };

  const changeSearch = (next: string) => {
    setSearchQuery(`${next}`);
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

  useDashboardKeys({
    active: dialogs.stack.length === 0 && !workbench.open,
    onMerge: () => {
      if (authed && focusedPull?.state === "open") {
        dialogs.open("mergePull", { pull: focusedPull });
      }
    },
    onBlock: () => {
      if (authed && focusedPull?.state === "open") {
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

  const selectedRepo = flow
    ? (repos.find((option) => option.key === repoKeyOf(flow)) ?? null)
    : null;

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
