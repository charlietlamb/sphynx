import { EvalStatusBadge } from "@sphynx/ui/components/evals/eval-status-badge";
import { TooltipProvider } from "@sphynx/ui/components/tooltip";
import { PageHeading } from "@sphynx/ui/components/ui/page-heading";
import { trialStatus } from "@sphynx/ui/lib/evals/eval-status";
import { createFileRoute } from "@tanstack/react-router";
import { CASE_DETAIL, CASE_RUNS } from "@/components/dev/case-fixtures";
import { RUN, TRIALS } from "@/components/dev/eval-fixtures";
import { PreviewScreen } from "@/components/dev/preview-screen";
import { RERUN_PLAN } from "@/components/dev/rerun-fixtures";
import {
  LOCAL_RUN,
  LOCAL_TRIAL,
  TIMED_OUT_TRIAL,
  VALIDATED_RUN,
  VALIDATED_SETUP,
  VALIDATED_TRIAL,
} from "@/components/dev/trial-fixtures";
import { AgentSetup } from "@/components/evals/agent-setup";
import { CaseActions } from "@/components/evals/case-actions";
import { CaseMeta } from "@/components/evals/case-meta";
import { CaseRuns } from "@/components/evals/case-runs";
import { Conversation } from "@/components/evals/conversation";
import { RerunPreview } from "@/components/evals/rerun-preview";
import { TrialCalls } from "@/components/evals/trial-calls";
import { TrialChecks } from "@/components/evals/trial-checks";
import { TrialPlaceholder } from "@/components/evals/trial-placeholder";
import { TrialView } from "@/components/evals/trial-view";
import { PageShell } from "@/components/layout/page-shell";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export const Route = createFileRoute("/dev/evals")({
  component: EvalsPreview,
  ssr: false,
});

const TRIAL = TRIALS[0];

function EvalsPreview() {
  return (
    <TooltipProvider>
      <div className="flex flex-col gap-10 pb-24">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 pt-6 xl:px-6">
          <h1>
            <PageHeading title="Evals" />
          </h1>
          <ThemeToggle />
        </div>

        <PreviewScreen name="Re-running a suite">
          <div className="mx-auto w-full max-w-2xl px-5 py-5">
            <RerunPreview plan={RERUN_PLAN} />
          </div>
        </PreviewScreen>

        <PreviewScreen name="Statuses">
          <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-3 px-5 py-5">
            <EvalStatusBadge status={trialStatus("running")} />
            <EvalStatusBadge status={trialStatus("passed")} />
            <EvalStatusBadge status={trialStatus("failed")} />
            <EvalStatusBadge status={trialStatus("queued")} />
          </div>
        </PreviewScreen>

        <PreviewScreen name="Thinking">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-5">
            <Conversation
              running
              trajectory={[
                {
                  _tag: "message",
                  role: "user",
                  text: "Add a health endpoint and verify it responds.",
                  finishedAtMillis: 1000,
                },
              ]}
              written={{ artifacts: [], trial: { trialId: "trl_preview" } }}
            />
            <Conversation
              running
              trajectory={[
                {
                  _tag: "message",
                  role: "user",
                  text: "Add a health endpoint and verify it responds.",
                  finishedAtMillis: 1000,
                },
                {
                  _tag: "message",
                  role: "assistant",
                  text: "Added `/health`. Checking that it responds.",
                  finishedAtMillis: 4200,
                },
              ]}
              written={{ artifacts: [], trial: { trialId: "trl_preview" } }}
            />
          </div>
        </PreviewScreen>

        <PreviewScreen name="Structured answer">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-5">
            <Conversation
              running={false}
              trajectory={[
                {
                  _tag: "message",
                  role: "user",
                  text: "Write the changelog for the last 7 days.",
                  finishedAtMillis: 1000,
                },
                {
                  _tag: "message",
                  role: "assistant",
                  text: '{"status":"created","posts":[{"postId":"post_fixture_1","title":"Performance improvements: faster audit log and dashboard preload","recommendations":"- Post this to the product updates channel.\\n- Add a before and after screenshot of the audit log."}],"reason":null}',
                  finishedAtMillis: 65_900,
                },
              ]}
              written={{ artifacts: [], trial: { trialId: "trl_preview" } }}
            />
          </div>
        </PreviewScreen>

        <PreviewScreen name="Validation and calls">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-5">
            <TrialChecks setup={VALIDATED_SETUP} trial={VALIDATED_TRIAL} />
            <TrialCalls
              trajectory={[
                {
                  _tag: "toolCall",
                  name: "notra-markdown.get_markdown",
                  input: "{}",
                  output: JSON.stringify({
                    content: [
                      {
                        type: "text",
                        text: "# Deploying Notra\n\n1. Set the **environment variables**.\n2. Run `bun run build`.\n3. Deploy and check the health endpoint.",
                      },
                    ],
                    structured_content: {
                      content:
                        "# Deploying Notra\n\n1. Set the **environment variables**.\n2. Run `bun run build`.\n3. Deploy and check the health endpoint.",
                      lineCount: 5,
                    },
                  }),
                  status: "completed",
                  finishedAtMillis: 0,
                },
                {
                  _tag: "toolCall",
                  name: "catalog.items_get",
                  input: '{"id":"missing"}',
                  error: "Unknown item: missing",
                  status: "failed",
                  finishedAtMillis: 1,
                },
                {
                  _tag: "toolCall",
                  name: "catalog.items_get",
                  input: '{"id":"ci_fixture"}',
                  output: '{"id":"ci_fixture","name":"CI fixture"}',
                  status: "completed",
                  finishedAtMillis: 2,
                },
                {
                  _tag: "command",
                  command: "catalog items list",
                  output: '[{"id":"ci_fixture","name":"CI fixture"}]',
                  exitCode: 0,
                  startedAtMillis: 3,
                  finishedAtMillis: 4,
                },
              ]}
            />
          </div>
        </PreviewScreen>

        <PreviewScreen name="Eval in code">
          <PageShell title="New eval" width="wide">
            <AgentSetup />
          </PageShell>
        </PreviewScreen>

        <PreviewScreen name="One case">
          <PageShell
            actions={<CaseActions detail={CASE_DETAIL} />}
            description={<CaseMeta subject={CASE_DETAIL} />}
            title={CASE_DETAIL.name}
            width="wide"
          >
            <CaseRuns
              caseId={CASE_DETAIL.id}
              onPage={() => undefined}
              page={CASE_RUNS}
            />
          </PageShell>
        </PreviewScreen>

        {TRIAL ? (
          <PreviewScreen name="One trial">
            <TrialView run={RUN} trial={TRIAL} />
          </PreviewScreen>
        ) : null}

        <PreviewScreen name="Trial judged by validators">
          <TrialView run={VALIDATED_RUN} trial={VALIDATED_TRIAL} />
        </PreviewScreen>

        <PreviewScreen name="Local trial that reported nothing">
          <TrialView run={LOCAL_RUN} trial={LOCAL_TRIAL} />
        </PreviewScreen>

        <PreviewScreen name="Trial that ran out of time">
          <TrialView run={LOCAL_RUN} trial={TIMED_OUT_TRIAL} />
        </PreviewScreen>

        <PreviewScreen name="Loading: one trial">
          <TrialPlaceholder />
        </PreviewScreen>
      </div>
    </TooltipProvider>
  );
}
