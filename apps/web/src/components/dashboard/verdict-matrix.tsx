import { SealCheckIcon } from "@phosphor-icons/react";
import type { QueuePull, ReviewerVerdict } from "@sphynx/schema/review-queue";
import { VerdictRow } from "@/components/dashboard/verdict-row";
import { SectionHeader } from "@/components/layout/section-header";

const STATE_ORDER: Record<ReviewerVerdict["state"], number> = {
  "changes-requested": 0,
  approved: 1,
  commented: 2,
};

function byImportance(a: ReviewerVerdict, b: ReviewerVerdict) {
  const state = STATE_ORDER[a.state] - STATE_ORDER[b.state];
  if (state !== 0) {
    return state;
  }
  if (a.kind !== b.kind) {
    return a.kind === "human" ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

function approves(count: number) {
  return count === 1 ? "1 approves" : `${count} approve`;
}

function wantsChanges(count: number) {
  return count === 1 ? "1 wants changes" : `${count} want changes`;
}

function consensusLine(pull: QueuePull) {
  const commented =
    pull.reviewers.length - pull.approvals - pull.changesRequested;
  if (pull.reviewers.length === 0) {
    return "no verdicts yet";
  }
  if (pull.approvals > 0 && pull.changesRequested > 0) {
    return `split verdict · ${approves(pull.approvals)} · ${wantsChanges(pull.changesRequested)}`;
  }
  if (pull.changesRequested > 0) {
    return wantsChanges(pull.changesRequested);
  }
  if (pull.approvals === pull.reviewers.length) {
    return "unanimous approval";
  }
  if (pull.approvals > 0) {
    return `${approves(pull.approvals)} · ${commented} commented`;
  }
  return "comments only";
}

interface VerdictMatrixProps {
  now: number;
  pull: QueuePull;
}

export function VerdictMatrix({ now, pull }: VerdictMatrixProps) {
  const sorted = [...pull.reviewers].sort(byImportance);
  return (
    <div className="flex flex-col gap-1">
      <SectionHeader
        icon={<SealCheckIcon className="size-3" weight="fill" />}
        label="Verdicts"
      />
      {sorted.length === 0 ? (
        <p className="py-1 text-[13px] text-muted-foreground">
          Nobody has reviewed this yet.
        </p>
      ) : (
        <>
          {sorted.map((reviewer) => (
            <VerdictRow key={reviewer.name} now={now} reviewer={reviewer} />
          ))}
          <p className="pt-0.5 text-[12px] text-muted-foreground">
            {consensusLine(pull)}
          </p>
        </>
      )}
    </div>
  );
}
