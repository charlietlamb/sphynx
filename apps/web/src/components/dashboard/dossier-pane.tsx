import {
  GitPullRequestIcon,
  SealCheckIcon,
  XCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { QueuePull } from "@sphynx/schema/review-queue";
import { EmptyState } from "@sphynx/ui/components/empty-state";
import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@sphynx/ui/components/ui/tabs";
import { cn } from "@sphynx/ui/lib/utils";
import { useState } from "react";
import { DossierActions } from "@/components/dashboard/dossier-actions";
import { DossierDescription } from "@/components/dashboard/dossier-description";
import { DossierSignals } from "@/components/dashboard/dossier-signals";
import { ThreadPreviews } from "@/components/dashboard/thread-previews";
import { usePullBody } from "@/components/dashboard/use-pull-body";
import { VerdictMatrix } from "@/components/dashboard/verdict-matrix";
import { GithubProfile } from "@/components/github/github-profile";
import { HAIRLINE_DIVIDE } from "@/components/layout/dividers";
import { PaneCard } from "@/components/layout/pane-card";
import { SectionHeader } from "@/components/layout/section-header";
import { type ClaimTone, claimFor } from "@/lib/claims";

const DESCRIPTION_WIDTHS = ["92%", "78%", "85%", "60%", "88%", "45%"];

const TONE_CLASSES: Record<ClaimTone, string> = {
  ready: "text-addition",
  blocked: "text-deletion",
  waiting: "text-foreground",
  neutral: "text-muted-foreground",
};

interface DossierPaneProps {
  canAct: boolean;
  installationId: number | null;
  now: number;
  onOpen: (pull: QueuePull) => void;
  pull: QueuePull | null;
}

function ClaimLine({ now, pull }: { now: number; pull: QueuePull }) {
  const claim = claimFor(pull, now);
  return (
    <p className="text-[13px] leading-snug">
      <span className={cn("font-semibold", TONE_CLASSES[claim.tone])}>
        {claim.status}
      </span>
      {claim.detail ? (
        <span className="text-muted-foreground"> · {claim.detail}</span>
      ) : null}
    </p>
  );
}

export function DossierPane({
  canAct,
  installationId,
  now,
  onOpen,
  pull,
}: DossierPaneProps) {
  const [tab, setTab] = useState("overview");
  if (!pull) {
    return (
      <EmptyState
        bordered={false}
        className="h-full"
        description="Every open pull request has been reviewed."
        icon={<SealCheckIcon weight="fill" />}
        title="Queue clear"
      />
    );
  }
  const hasDescription = pull.hasBody;
  const activeTab = hasDescription ? tab : "overview";
  return (
    <PaneCard className="fade-in h-full animate-in duration-150">
      <div className="flex flex-col px-4">
        <SectionHeader
          action={
            <DossierActions
              canAct={canAct}
              onOpen={() => onOpen(pull)}
              pull={pull}
            />
          }
          className="-mx-4 px-4"
          icon={<GitPullRequestIcon className="size-3" weight="fill" />}
          label={`#${pull.number}`}
        />
        <div className="flex flex-col pt-3 pb-4">
          <h2 className="text-balance font-heading text-[15px] leading-snug tracking-tight">
            {pull.title}
          </h2>
          <div className="mt-2.5">
            <ClaimLine now={now} pull={pull} />
          </div>
          <div className="mt-3.5 flex items-center gap-2">
            <GithubProfile
              avatarUrl={pull.author?.avatarUrl}
              labelClassName="text-muted-foreground"
              login={pull.author?.login ?? null}
              size="sm"
            />
            <DossierSignals pull={pull} />
          </div>
        </div>
      </div>
      {hasDescription ? (
        <div className="border-border border-y px-2 pt-1 pb-1">
          <Tabs
            onValueChange={(value) => setTab(String(value))}
            value={activeTab}
          >
            <TabsList variant="line">
              <TabsTrigger className="text-[13px]" value="overview">
                Overview
              </TabsTrigger>
              <TabsTrigger className="text-[13px]" value="description">
                Description
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      ) : (
        <div className="border-border border-b" />
      )}
      {activeTab === "description" ? (
        <DossierBody installationId={installationId} pull={pull} />
      ) : (
        <DossierOverview canAct={canAct} now={now} pull={pull} />
      )}
    </PaneCard>
  );
}

function DossierBody({
  installationId,
  pull,
}: {
  installationId: number | null;
  pull: QueuePull;
}) {
  const { body, isError, isPending } = usePullBody(pull, installationId, true);
  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-3">
      {isPending ? <DescriptionSkeleton /> : null}
      {isError ? (
        <p className="text-muted-foreground text-xs">
          Couldn't load the description.
        </p>
      ) : null}
      {body ? <DossierDescription body={body} /> : null}
    </div>
  );
}

function DescriptionSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {DESCRIPTION_WIDTHS.map((width) => (
        <Skeleton className="h-3" key={width} style={{ width }} />
      ))}
    </div>
  );
}

function DossierOverview({
  canAct,
  now,
  pull,
}: {
  canAct: boolean;
  now: number;
  pull: QueuePull;
}) {
  return (
    <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-4">
      <VerdictMatrix now={now} pull={pull} />
      {pull.ciFailures.length > 0 ? (
        <div className="flex flex-col">
          <SectionHeader
            icon={<XCircleIcon className="size-3" weight="fill" />}
            label="Failing checks"
          />
          <div className={cn("flex flex-col", HAIRLINE_DIVIDE)}>
            {pull.ciFailures.map((check) => (
              <a
                className="group -mx-4 flex items-center gap-2.5 px-4 py-3"
                href={
                  check.url ??
                  `https://github.com/${pull.owner}/${pull.repo}/pull/${pull.number}/checks`
                }
                key={check.name}
                rel="noreferrer"
                target="_blank"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-deletion/10 text-deletion">
                  <XIcon aria-hidden className="size-3" weight="bold" />
                </span>
                <span className="min-w-0 truncate text-[13px] text-foreground/80 underline-offset-2 transition-colors group-hover:text-foreground group-hover:underline">
                  {check.name}
                </span>
              </a>
            ))}
          </div>
        </div>
      ) : null}
      <ThreadPreviews canAct={canAct} pull={pull} />
    </div>
  );
}
