import type { QueuePull, ReviewerVerdict } from "@sphynx/schema/review-queue";
import { VerdictRow } from "@/components/dashboard/verdict-row";

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

function consensusLine(pull: QueuePull) {
  const commented =
    pull.reviewers.length - pull.approvals - pull.changesRequested;
  if (pull.reviewers.length === 0) {
    return "no verdicts yet";
  }
  if (pull.approvals > 0 && pull.changesRequested > 0) {
    return `split verdict · ${pull.approvals} approve · ${pull.changesRequested} want changes`;
  }
  if (pull.changesRequested > 0) {
    return `${pull.changesRequested} want changes`;
  }
  if (pull.approvals === pull.reviewers.length) {
    return "unanimous approval";
  }
  if (pull.approvals > 0) {
    return `${pull.approvals} approve · ${commented} commented`;
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
      <p className="font-medium text-[11px] text-muted-foreground/60">
        verdicts
      </p>
      {sorted.length === 0 ? (
        <p className="py-1 text-[13px] text-muted-foreground">
          Nobody has reviewed this yet.
        </p>
      ) : (
        <>
          {sorted.map((reviewer) => (
            <VerdictRow key={reviewer.name} now={now} reviewer={reviewer} />
          ))}
          <p className="pt-1 text-[12px] text-muted-foreground">
            {consensusLine(pull)}
          </p>
        </>
      )}
    </div>
  );
}
