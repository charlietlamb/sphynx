import { SealCheckIcon } from "@phosphor-icons/react";
import type { QueuePull, ReviewerVerdict } from "@sphynx/schema/review-queue";
import { cn } from "@sphynx/ui/lib/utils";
import { VerdictRow } from "@/components/dashboard/verdict-row";
import { HAIRLINE_DIVIDE } from "@/components/layout/dividers";
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

interface VerdictMatrixProps {
  now: number;
  pull: QueuePull;
}

export function VerdictMatrix({ now, pull }: VerdictMatrixProps) {
  const sorted = [...pull.reviewers].sort(byImportance);
  return (
    <div className="flex flex-col">
      <SectionHeader
        icon={<SealCheckIcon className="size-3" weight="fill" />}
        label="Verdicts"
      />
      {sorted.length === 0 ? (
        <p className="py-1 text-[13px] text-muted-foreground">
          Nobody has reviewed this yet.
        </p>
      ) : (
        <div className={cn("flex flex-col", HAIRLINE_DIVIDE)}>
          {sorted.map((reviewer) => (
            <VerdictRow key={reviewer.name} now={now} reviewer={reviewer} />
          ))}
        </div>
      )}
    </div>
  );
}
