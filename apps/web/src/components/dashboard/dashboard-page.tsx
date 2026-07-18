import { DASHBOARD_KEY_HELP } from "@/components/dashboard/dashboard-key-help";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DossierPane } from "@/components/dashboard/dossier-pane";
import { DossierSkeleton } from "@/components/dashboard/dossier-skeleton";
import { FlowRail } from "@/components/dashboard/flow-rail";
import { KeyHint } from "@/components/dashboard/key-hint";
import { QueuePane } from "@/components/dashboard/queue-pane";
import { QueueSkeleton } from "@/components/dashboard/queue-skeleton";
import { RailSkeleton } from "@/components/dashboard/rail-skeleton";
import { RepoSwitcher } from "@/components/dashboard/repo-switcher";
import { SwitcherSkeleton } from "@/components/dashboard/switcher-skeleton";
import { useDashboardState } from "@/components/dashboard/use-dashboard-state";

export function DashboardPage() {
  const {
    actionDialog,
    authed,
    branchFilter,
    flow,
    focused,
    focusedPull,
    openPull,
    openPullNumber,
    queue,
    rail,
    repos,
    selectBranch,
    selectRepo,
    selectedRepo,
    setActionDialog,
    setFocusedKey,
  } = useDashboardState();
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
            onOpen={openPull}
            pull={focusedPull}
          />
        ) : (
          <DossierSkeleton />
        )
      }
      githubUrl={flow ? `https://github.com/${flow.owner}/${flow.repo}` : null}
      hints={DASHBOARD_KEY_HELP.map((binding) => (
        <KeyHint
          action={binding.action}
          key={binding.action}
          keys={binding.keys}
        />
      ))}
      queue={
        queue && flow ? (
          <QueuePane
            focusedKey={focused}
            now={now}
            onFocus={setFocusedKey}
            onOpen={openPull}
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
            onOpenNumber={openPullNumber}
            onSelect={selectBranch}
            selected={branchFilter}
          />
        ) : (
          <RailSkeleton />
        )
      }
      switcher={
        selectedRepo ? (
          <RepoSwitcher
            onSelect={selectRepo}
            repos={repos}
            selected={selectedRepo}
          />
        ) : (
          <SwitcherSkeleton />
        )
      }
    />
  );
}
