import { PipelineSchema, type RepoFlow } from "@sphynx/schema/review-queue";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Schema } from "effect";
import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { ActionDialog } from "@/components/dashboard/dossier-actions";
import { DossierPane } from "@/components/dashboard/dossier-pane";
import { DossierSkeleton } from "@/components/dashboard/dossier-skeleton";
import { FlowRail } from "@/components/dashboard/flow-rail";
import { KeyHint } from "@/components/dashboard/key-hint";
import { QueuePane } from "@/components/dashboard/queue-pane";
import { QueueSkeleton } from "@/components/dashboard/queue-skeleton";
import { RailSkeleton } from "@/components/dashboard/rail-skeleton";
import {
  type RepoOption,
  RepoSwitcher,
} from "@/components/dashboard/repo-switcher";
import { SwitcherSkeleton } from "@/components/dashboard/switcher-skeleton";
import { useDashboardKeys } from "@/components/dashboard/use-dashboard-keys";
import { useSettings } from "@/components/settings/settings-provider";
import {
  buildBranchQueue,
  filterQueue,
  isContested,
  isMergeable,
  pullKey,
  railBranches,
  repoKeyOf,
} from "@/lib/attention";
import { useSession } from "@/lib/auth-client";

async function fetchPipeline(authed: boolean) {
  const response = await fetch(
    authed && !import.meta.env.DEV
      ? "/api/github/pipeline"
      : "/api/dev/pipeline"
  );
  if (!response.ok) {
    throw new Error(`pipeline unavailable (${response.status})`);
  }
  return Schema.decodeUnknownPromise(PipelineSchema)(await response.json());
}

function toRepoOption(flow: RepoFlow): RepoOption {
  let mergeable = 0;
  let contested = 0;
  for (const pull of flow.openPulls) {
    if (isMergeable(pull)) {
      mergeable += 1;
    }
    if (isContested(pull)) {
      contested += 1;
    }
  }
  return {
    key: repoKeyOf(flow),
    owner: flow.owner,
    repo: flow.repo,
    openCount: flow.openPulls.length,
    mergeable,
    contested,
  };
}

function cycle(index: number, delta: number, length: number) {
  return (index + delta + length) % length;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: session, isPending: sessionPending } = useSession();
  const authed = Boolean(session?.user);
  const pipeline = useQuery({
    queryKey: ["pipeline", authed],
    queryFn: () => fetchPipeline(authed),
    enabled: !sessionPending,
    staleTime: 60_000,
  });
  const { settings, update: updateSettings } = useSettings();
  const repoKey = settings.selectedRepo;
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const [actionDialog, setActionDialog] = useState<ActionDialog>(null);

  const flows = useMemo(() => {
    const active = (pipeline.data?.repos ?? []).filter(
      (flow) => flow.openPulls.length > 0
    );
    return [...active].sort((a, b) => b.openPulls.length - a.openPulls.length);
  }, [pipeline.data]);

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
    () => (fullQueue ? filterQueue(fullQueue, branchFilter) : null),
    [fullQueue, branchFilter]
  );

  const rail = useMemo(
    () => (flow && fullQueue ? railBranches(flow, fullQueue) : []),
    [flow, fullQueue]
  );

  const focused = (() => {
    if (!queue) {
      return null;
    }
    if (focusedKey && queue.order.includes(focusedKey)) {
      return focusedKey;
    }
    return queue.order[0] ?? null;
  })();

  const focusedPull =
    flow?.openPulls.find((pull) => pullKey(pull) === focused) ?? null;

  const moveFocus = (delta: number) => {
    if (!queue || queue.order.length === 0) {
      return;
    }
    const index = focused ? queue.order.indexOf(focused) : 0;
    setFocusedKey(queue.order[cycle(index, delta, queue.order.length)] ?? null);
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

  const openPullPage = (owner: string, repo: string, number: number) => {
    navigate({
      to: "/$owner/$repo/pull/$number",
      params: { owner, repo, number },
    });
  };

  useDashboardKeys({
    active: actionDialog === null,
    onMerge: () => {
      if (authed && focusedPull) {
        setActionDialog("merge");
      }
    },
    onBlock: () => {
      if (authed && focusedPull) {
        setActionDialog("block");
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
        openPullPage(focusedPull.owner, focusedPull.repo, focusedPull.number);
      }
    },
    onNextRepo: () => moveRepo(1),
    onPrevRepo: () => moveRepo(-1),
  });

  const now = Date.now();

  return (
    <DashboardShell
      dossier={
        queue ? (
          <DossierPane
            actionDialog={actionDialog}
            canAct={authed}
            now={now}
            onActionDialogChange={setActionDialog}
            onOpen={(pull) => openPullPage(pull.owner, pull.repo, pull.number)}
            pull={focusedPull}
          />
        ) : (
          <DossierSkeleton />
        )
      }
      githubUrl={flow ? `https://github.com/${flow.owner}/${flow.repo}` : null}
      hints={
        <>
          <KeyHint action="move" keys="j k" />
          <KeyHint action="open" keys="p" />
          <KeyHint action="merge" keys="m" />
          <KeyHint action="block" keys="b" />
          <KeyHint action="branch" keys="1–9" />
          <KeyHint action="repo" keys="[ ]" />
        </>
      }
      queue={
        queue && flow ? (
          <QueuePane
            focusedKey={focused}
            now={now}
            onFocus={setFocusedKey}
            onOpen={(pull) => openPullPage(pull.owner, pull.repo, pull.number)}
            queue={queue}
          />
        ) : (
          <QueueSkeleton />
        )
      }
      rail={
        flow ? (
          <FlowRail
            canAct={authed}
            flow={flow}
            items={rail}
            now={now}
            onOpenNumber={(number) =>
              openPullPage(flow.owner, flow.repo, number)
            }
            onSelect={selectBranch}
            selected={branchFilter}
          />
        ) : (
          <RailSkeleton />
        )
      }
      switcher={
        flow ? (
          <RepoSwitcher
            onSelect={selectRepo}
            repos={repos}
            selected={toRepoOption(flow)}
          />
        ) : (
          <SwitcherSkeleton />
        )
      }
    />
  );
}
