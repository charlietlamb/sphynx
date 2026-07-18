import type { QueuePull } from "@sphynx/schema/review-queue";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import { cn } from "@sphynx/ui/lib/utils";
import { DossierActions } from "@/components/dashboard/dossier-actions";
import { ThreadPreviews } from "@/components/dashboard/thread-previews";
import { VerdictMatrix } from "@/components/dashboard/verdict-matrix";
import { shortAge } from "@/lib/age";
import { sizeClass } from "@/lib/attention";
import { claimFor } from "@/lib/claims";

const CI_LABELS: Record<QueuePull["ci"], string> = {
  success: "checks green",
  failure: "checks failing",
  pending: "checks running",
  none: "no checks",
};

interface DossierPaneProps {
  canAct: boolean;
  now: number;
  onOpen: (pull: QueuePull) => void;
  pull: QueuePull | null;
}

export function DossierPane({ canAct, now, onOpen, pull }: DossierPaneProps) {
  if (!pull) {
    return (
      <p className="px-5 py-4 text-[13px] text-muted-foreground">
        Queue clear — nothing to decide.
      </p>
    );
  }
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-2 border-border border-b px-5 py-4">
        <p className="font-mono text-[11px] text-muted-foreground">
          #{pull.number}
          <span className="text-muted-foreground/50">
            {" "}
            · {pull.headRefName} → {pull.baseRefName}
          </span>
        </p>
        <h2 className="text-balance font-heading text-xl leading-snug tracking-tight">
          {pull.title}
        </h2>
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
          <span className="font-mono text-[11px] text-muted-foreground">
            {pull.author?.login ?? "unknown"} · updated{" "}
            {shortAge(pull.updatedAt, now)} ago
          </span>
          {pull.isDraft ? (
            <span className="rounded-sm bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              draft
            </span>
          ) : null}
        </div>
      </div>
      <p className="text-pretty border-border border-b px-5 py-3.5 text-[14px] leading-relaxed">
        {claimFor(pull, now)}
      </p>
      <div className="border-border border-b px-5 py-4">
        <VerdictMatrix now={now} pull={pull} />
      </div>
      {pull.ciFailures.length > 0 ? (
        <div className="flex flex-wrap items-baseline gap-1.5 border-border border-b px-5 py-3">
          <span className="mr-1 font-mono text-[11px] text-muted-foreground/60">
            failing
          </span>
          {pull.ciFailures.map((name) => (
            <span
              className="rounded-sm bg-deletion/10 px-1.5 py-0.5 font-mono text-[10px] text-deletion"
              key={name}
            >
              {name}
            </span>
          ))}
        </div>
      ) : null}
      <ThreadPreviews pull={pull} />
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-border border-b px-5 py-3 font-mono text-[11px] text-muted-foreground">
        <span
          className={cn(
            pull.ci === "failure" && "text-deletion",
            pull.ci === "success" && "text-addition"
          )}
        >
          {CI_LABELS[pull.ci]}
        </span>
        {pull.unresolvedThreads > 0 ? (
          <span>
            {pull.unresolvedThreads} open thread
            {pull.unresolvedThreads === 1 ? "" : "s"}
          </span>
        ) : null}
        <span className="tabular-nums">
          <span className="text-addition">+{pull.additions}</span>{" "}
          <span className="text-deletion">−{pull.deletions}</span>
        </span>
        <span className="tabular-nums">
          {pull.changedFiles} file{pull.changedFiles === 1 ? "" : "s"}
        </span>
        <span className="uppercase">{sizeClass(pull)}</span>
      </div>
      <DossierActions canAct={canAct} onOpen={() => onOpen(pull)} pull={pull} />
    </div>
  );
}
