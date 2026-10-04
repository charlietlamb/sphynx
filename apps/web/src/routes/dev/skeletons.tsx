import { TooltipProvider } from "@sphynx/ui/components/tooltip";
import {
  DataTable,
  DataTableBody,
  DataTableHead,
} from "@sphynx/ui/components/ui/data-table";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@sphynx/ui/components/ui/sidebar";
import { createFileRoute } from "@tanstack/react-router";
import { ChannelsScreen } from "@/components/channels/channels-screen";
import { NavUserIdentity } from "@/components/dashboard/nav-user-identity";
import { CASE_DETAIL, CASE_RUNS } from "@/components/dev/case-fixtures";
import { RUN, TRIALS } from "@/components/dev/eval-fixtures";
import { ENVIRONMENT, KEYS, MEMBERS } from "@/components/dev/settings-fixtures";
import { SkeletonPair } from "@/components/dev/skeleton-pair";
import {
  VALIDATED_SETUP,
  VALIDATED_TRIAL,
} from "@/components/dev/trial-fixtures";
import { CaseActions } from "@/components/evals/case-actions";
import { CaseMeta } from "@/components/evals/case-meta";
import { CaseRuns } from "@/components/evals/case-runs";
import { CasesTable } from "@/components/evals/cases-table";
import { TrialCalls } from "@/components/evals/trial-calls";
import { TrialChecks } from "@/components/evals/trial-checks";
import { TrialPlaceholder } from "@/components/evals/trial-placeholder";
import { TrialView } from "@/components/evals/trial-view";
import { CursorPagination } from "@/components/layout/cursor-pagination";
import { PageShell } from "@/components/layout/page-shell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { MemberRow } from "@/components/organization/member-row";
import { PromptEditor } from "@/components/prompts/prompt-editor";
import { PromptList } from "@/components/prompts/prompt-list";
import { ApiKeyList } from "@/components/settings/api-key-list";
import { EnvironmentList } from "@/components/settings/environment/environment-list";
import { InstalledAccount } from "@/components/settings/installed-account";
import { OrganizationForm } from "@/components/settings/organization-form";
import { PLACEHOLDER_CASE_PAGE } from "@/lib/evals/eval-placeholders";
import {
  PLACEHOLDER_PROMPTS,
  placeholderVersions,
} from "@/lib/prompts/prompt-placeholders";
import { PLACEHOLDER_CHANNELS } from "@/lib/settings/settings-placeholders";
import { MEMBERS_TABLE } from "@/lib/settings/settings-tables";

export const Route = createFileRoute("/dev/skeletons")({
  component: SkeletonsPreview,
  ssr: false,
});

const NOTHING = () => undefined;
const [TRIAL] = TRIALS;
const VERSIONS = placeholderVersions("placeholder");

function SkeletonsPreview() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-12 px-6 py-6">
          <div className="flex justify-end">
            <ThemeToggle />
          </div>

          <SkeletonPair name="Cases">
            <CasesTable
              cases={PLACEHOLDER_CASE_PAGE.cases}
              pagination={
                <CursorPagination
                  canGoNext
                  canGoPrev={false}
                  disabled={false}
                  onNext={NOTHING}
                  onPrev={NOTHING}
                  page={1}
                />
              }
            />
          </SkeletonPair>

          <SkeletonPair name="Case header">
            <PageShell
              actions={<CaseActions detail={CASE_DETAIL} />}
              description={<CaseMeta subject={CASE_DETAIL} />}
              title={CASE_DETAIL.name}
              width="wide"
            >
              <CaseRuns
                caseId={CASE_DETAIL.id}
                onPage={NOTHING}
                page={CASE_RUNS}
              />
            </PageShell>
          </SkeletonPair>

          {TRIAL === undefined ? null : (
            <SkeletonPair name="Trial">
              <TrialView run={RUN} trial={TRIAL} />
            </SkeletonPair>
          )}

          <SkeletonPair name="Checks">
            <TrialChecks setup={VALIDATED_SETUP} trial={VALIDATED_TRIAL} />
          </SkeletonPair>

          {TRIAL === undefined ? null : (
            <SkeletonPair name="Calls">
              <TrialCalls trajectory={TRIAL.trajectory} />
            </SkeletonPair>
          )}

          <SkeletonPair name="Members">
            <DataTable
              columns={MEMBERS_TABLE.columns}
              label={MEMBERS_TABLE.label}
            >
              <DataTableHead headings={MEMBERS_TABLE.headings} />
              <DataTableBody>
                {MEMBERS.map((member) => (
                  <MemberRow key={member.id} member={member} />
                ))}
              </DataTableBody>
            </DataTable>
          </SkeletonPair>

          <SkeletonPair name="API keys">
            <ApiKeyList
              error={null}
              loading={false}
              onRevoke={NOTHING}
              rows={KEYS}
            />
          </SkeletonPair>

          <SkeletonPair name="Environment">
            <EnvironmentList
              error={null}
              loading={false}
              onDisconnect={NOTHING}
              onEdit={NOTHING}
              onReconnect={NOTHING}
              onRemove={NOTHING}
              rows={ENVIRONMENT}
            />
          </SkeletonPair>

          <SkeletonPair name="Channels">
            <ChannelsScreen
              error={null}
              isPending={false}
              onDelete={NOTHING}
              onEdit={NOTHING}
              onNew={NOTHING}
              rows={PLACEHOLDER_CHANNELS}
            />
          </SkeletonPair>

          <SkeletonPair name="Codebase">
            <InstalledAccount
              account={{
                installationId: 1,
                login: "charlietlamb",
                manageUrl: "https://github.com",
                repositorySelection: "selected",
              }}
              onRefresh={NOTHING}
              refreshing={false}
              summary="12 repositories"
            />
          </SkeletonPair>

          <SkeletonPair name="Organization">
            <OrganizationForm name="Sphynx" slug="sphynx" />
          </SkeletonPair>

          <SkeletonPair name="Prompts">
            <PromptList
              hasMore={false}
              loadingMore={false}
              onLoadMore={NOTHING}
              prompts={PLACEHOLDER_PROMPTS}
            />
          </SkeletonPair>

          <SkeletonPair name="Prompt editor">
            <PromptEditor
              id="placeholder"
              latest={VERSIONS[0] ?? null}
              versions={VERSIONS}
            />
          </SkeletonPair>

          <section className="flex flex-col gap-3" data-loading="Trial">
            <span className="font-medium text-muted-foreground text-xs">
              Trial while loading
            </span>
            <TrialPlaceholder />
          </section>

          <SkeletonPair name="Account">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg">
                  <NavUserIdentity
                    user={{
                      email: "charlie@sphynx.sh",
                      initials: "CL",
                      name: "Charlie Lamb",
                    }}
                  />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SkeletonPair>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
