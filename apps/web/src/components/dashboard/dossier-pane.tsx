import { XCircleIcon, XIcon } from "@phosphor-icons/react";
import type { QueuePull } from "@sphynx/schema/review-queue";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
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
import { HAIRLINE_DIVIDE } from "@/components/layout/dividers";
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
    <p className="text-[12px] leading-snug">
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
      <p className="px-4 py-4 text-[13px] text-muted-foreground">
        Queue clear, nothing to decide.
      </p>
    );
  }
  const hasDescription = pull.hasBody;
  const activeTab = hasDescription ? tab : "overview";
  return (
    <div className="fade-in flex h-full min-h-0 flex-1 animate-in flex-col duration-150">
      <div className="flex flex-col gap-2 bg-background px-4 pt-4 pb-2">
        <h2 className="text-balance font-heading text-xl leading-snug tracking-tight">
          {pull.title}{" "}
          <span className="text-muted-foreground/60">#{pull.number}</span>
        </h2>
        <ClaimLine now={now} pull={pull} />
        <div className="flex items-center gap-2">
          <Avatar className="size-4 rounded-full">
            <AvatarImage
              alt={pull.author?.login ?? "unknown"}
              className="rounded-full"
              src={pull.author?.avatarUrl}
            />
            <AvatarFallback className="rounded-full text-[8px]">
              {pull.author?.login[0] ?? "?"}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 truncate text-[11px] text-muted-foreground">
            {pull.author?.login ?? "unknown"}
          </span>
          <DossierSignals pull={pull} />
        </div>
      </div>
      {hasDescription ? (
        <div className="border-border border-y px-2 pt-1 pb-1">
          <Tabs
            onValueChange={(value) => setTab(String(value))}
            value={activeTab}
          >
            <TabsList variant="line">
              <TabsTrigger className="text-[12px]" value="overview">
                Overview
              </TabsTrigger>
              <TabsTrigger className="text-[12px]" value="description">
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
      <DossierActions canAct={canAct} onOpen={() => onOpen(pull)} pull={pull} />
    </div>
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
    <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="border-border border-b px-4">
        <VerdictMatrix now={now} pull={pull} />
      </div>
      {pull.ciFailures.length > 0 ? (
        <div className="flex flex-col border-border border-b px-4">
          <SectionHeader
            icon={<XCircleIcon className="size-3" weight="fill" />}
            label="Failing checks"
          />
          <div className={cn("flex flex-col", HAIRLINE_DIVIDE)}>
            {pull.ciFailures.map((check) => (
              <a
                className="group -mx-4 flex items-center gap-2 px-4 py-2"
                href={
                  check.url ??
                  `https://github.com/${pull.owner}/${pull.repo}/pull/${pull.number}/checks`
                }
                key={check.name}
                rel="noreferrer"
                target="_blank"
              >
                <XIcon
                  aria-hidden
                  className="size-2.5 shrink-0 text-deletion"
                  weight="bold"
                />
                <span className="min-w-0 truncate font-mono text-[11px] text-foreground/80 underline-offset-2 transition-colors group-hover:text-foreground group-hover:underline">
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
