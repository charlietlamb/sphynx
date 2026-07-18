import type { QueuePull } from "@sphynx/schema/review-queue";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import { cn } from "@sphynx/ui/lib/utils";
import { DossierActions } from "@/components/dashboard/dossier-actions";
import { DossierSignals } from "@/components/dashboard/dossier-signals";
import { ThreadPreviews } from "@/components/dashboard/thread-previews";
import { VerdictMatrix } from "@/components/dashboard/verdict-matrix";
import { shortAge } from "@/lib/age";
import { type ClaimTone, claimFor } from "@/lib/claims";

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
          <span className="text-[11px] text-muted-foreground">
            {pull.author?.login ?? "unknown"} · updated{" "}
            {shortAge(pull.updatedAt, now)} ago
          </span>
          <DossierSignals pull={pull} />
        </div>
      </div>
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
      <ThreadPreviews canAct={canAct} pull={pull} />
      <DossierActions canAct={canAct} onOpen={() => onOpen(pull)} pull={pull} />
    </div>
  );
}
