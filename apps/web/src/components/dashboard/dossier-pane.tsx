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
import { type ClaimTone, claimFor, plural } from "@/lib/claims";

const CI_LABELS: Record<QueuePull["ci"], string> = {
  success: "checks green",
  failure: "checks failing",
  pending: "checks running",
  none: "no checks",
};

const TONE_CLASSES: Record<ClaimTone, string> = {
  ready: "text-addition",
  blocked: "text-deletion",
  waiting: "text-foreground",
  neutral: "text-muted-foreground",
};

interface DossierPaneProps {
  canAct: boolean;
  now: number;
  onOpen: (pull: QueuePull) => void;
  pull: QueuePull | null;
}

function ClaimBlock({ now, pull }: { now: number; pull: QueuePull }) {
  const claim = claimFor(pull, now);
  return (
    <div className="flex flex-col gap-0.5 border-border border-b px-5 py-3.5">
      <p
        className={cn(
          "font-semibold text-[14px] leading-snug",
          TONE_CLASSES[claim.tone]
        )}
      >
        {claim.status}
      </p>
      {claim.detail ? (
        <p className="text-[12px] text-muted-foreground">{claim.detail}</p>
      ) : null}
    </div>
  );
}

export function DossierPane({ canAct, now, onOpen, pull }: DossierPaneProps) {
  if (!pull) {
    return (
      <p className="px-5 py-4 text-[13px] text-muted-foreground">
        Queue clear, nothing to decide.
      </p>
    );
  }
  return (
    <div className="fade-in flex flex-1 animate-in flex-col duration-150">
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
          <span className="text-[11px] text-muted-foreground">
            {pull.author?.login ?? "unknown"} · updated{" "}
            {shortAge(pull.updatedAt, now)} ago
          </span>
        </div>
      </div>
      <ClaimBlock now={now} pull={pull} />
      <div className="border-border border-b px-5 py-4">
        <VerdictMatrix now={now} pull={pull} />
      </div>
      {pull.ciFailures.length > 0 ? (
        <div className="flex flex-col gap-1.5 border-border border-b px-5 py-3">
          <span className="font-medium text-[11px] text-muted-foreground/60">
            failing checks
          </span>
          {pull.ciFailures.map((name) => (
            <span className="flex items-center gap-2" key={name}>
              <span aria-hidden className="text-[11px] text-deletion">
                ✕
              </span>
              <span className="min-w-0 truncate font-mono text-[11px] text-foreground/80">
                {name}
              </span>
            </span>
          ))}
        </div>
      ) : null}
      <ThreadPreviews pull={pull} />
      <div className="mt-auto flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3 text-[11px] text-muted-foreground tabular-nums">
        <span
          className={cn(
            pull.ci === "failure" && "text-deletion",
            pull.ci === "success" && "text-addition"
          )}
        >
          {CI_LABELS[pull.ci]}
        </span>
        {pull.unresolvedThreads > 0 ? (
          <span>{plural(pull.unresolvedThreads, "open thread")}</span>
        ) : null}
        <span className="tabular-nums">
          <span className="text-addition">+{pull.additions}</span>{" "}
          <span className="text-deletion">−{pull.deletions}</span>
        </span>
        <span className="tabular-nums">
          {plural(pull.changedFiles, "file")}
        </span>
      </div>
      <DossierActions canAct={canAct} onOpen={() => onOpen(pull)} pull={pull} />
    </div>
  );
}
