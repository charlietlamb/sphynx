import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import { DashboardCommands } from "@/components/dashboard/dashboard-commands";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DossierPane } from "@/components/dashboard/dossier-pane";
import { DossierSkeleton } from "@/components/dashboard/dossier-skeleton";
import { FlowRail } from "@/components/dashboard/flow-rail";
import { InstallRequired } from "@/components/dashboard/install-required";
import { OrgSwitcher } from "@/components/dashboard/org-switcher";
import { QueuePane } from "@/components/dashboard/queue-pane";
import { QueueSkeleton } from "@/components/dashboard/queue-skeleton";
import { RailSkeleton } from "@/components/dashboard/rail-skeleton";
import { ReauthRequired } from "@/components/dashboard/reauth-required";
import { RepoSwitcher } from "@/components/dashboard/repo-switcher";
import { SwitcherSkeleton } from "@/components/dashboard/switcher-skeleton";
import { useDashboardState } from "@/components/dashboard/use-dashboard-state";
import { ErrorCard } from "@/components/layout/error-card";
import { WorkbenchSheet } from "@/components/workbench/workbench-sheet";
import { WorkbenchTrigger } from "@/components/workbench/workbench-trigger";
import { installErrorDetail } from "@/lib/auth-error";

export function DashboardView() {
  const {
    allRepos,
    authed,
    changeSearch,
    search,
    searchInput,
    searchQuery,
    toggleAllRepos,
    branchFilter,
    flow,
    focused,
    activeInstallation,
    focusedPull,
    installationId,
    installations,
    installError,
    needsInstall,
    needsReauth,
    selectInstallation,
    openPull,
    openPullNumber,
    queue,
    queueFilter,
    rail,
    repos,
    selectBranch,
    selectQueueFilter,
    selectRepo,
    selectedRepo,
    setFocusedKey,
    workbench,
  } = useDashboardState();
  const now = Date.now();

  if (needsReauth) {
    return <ReauthRequired />;
  }

  if (installError) {
    return (
      <ErrorCard
        description="Sphynx couldn't load your GitHub installations. This is usually GitHub being briefly unavailable."
        detail={installErrorDetail(installError)}
        onRetry={() => window.location.reload()}
        title="Couldn't reach GitHub"
      />
    );
  }

  if (needsInstall) {
    return <InstallRequired />;
  }

  return (
    <>
      <DashboardCommands
        authed={authed}
        focusedPull={focusedPull}
        onOpenPull={openPull}
        onSelectRepo={selectRepo}
        onToggleWorkbench={workbench.toggle}
        repos={repos}
        searchInput={searchInput}
        selectedRepo={selectedRepo}
      />
      <DashboardShell
        dossier={
          queue && !(search.isPending && !focusedPull) ? (
            <DossierPane
              canAct={authed}
              installationId={installationId}
              now={now}
              onOpen={openPull}
              pull={focusedPull}
            />
          ) : (
            <DossierSkeleton />
          )
        }
        githubUrl={
          flow ? `https://github.com/${flow.owner}/${flow.repo}` : null
        }
        queue={
          queue && flow ? (
            <QueuePane
              allRepos={allRepos}
              filter={queueFilter}
              focusedKey={focused}
              now={now}
              onFilter={selectQueueFilter}
              onFocus={setFocusedKey}
              onOpen={openPull}
              onSearch={changeSearch}
              onToggleRepos={toggleAllRepos}
              queue={queue}
              search={search}
              searchInput={searchInput}
              searchQuery={searchQuery}
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
        railFooter={
          flow ? (
            <WorkbenchTrigger
              onOpen={() => workbench.setOpen(true)}
              unseen={workbench.unseen}
            />
          ) : (
            <div className="flex h-9 w-full shrink-0 items-center gap-2 border-border border-t px-3">
              <Skeleton className="size-3.5 shrink-0 rounded" />
              <Skeleton className="h-3 w-20" />
            </div>
          )
        }
        switcher={
          selectedRepo ? (
            <span className="flex min-w-0 items-center">
              <OrgSwitcher
                installations={installations}
                onSelect={selectInstallation}
                selected={activeInstallation}
              />
              <span
                aria-hidden
                className="select-none text-[13px] text-muted-foreground/40"
              >
                /
              </span>
              <RepoSwitcher
                onSelect={selectRepo}
                repos={repos}
                selected={selectedRepo}
              />
            </span>
          ) : (
            <SwitcherSkeleton />
          )
        }
      />
      {flow ? (
        <WorkbenchSheet
          events={workbench.events}
          isError={workbench.isError}
          isPending={workbench.isPending}
          key={`${flow.owner}/${flow.repo}`}
          onOpenChange={workbench.setOpen}
          onRefetch={workbench.refetch}
          open={workbench.open}
          owner={flow.owner}
          repo={flow.repo}
          viewer={workbench.viewer}
        />
      ) : null}
    </>
  );
}
