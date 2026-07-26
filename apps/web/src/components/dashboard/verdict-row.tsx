import type { ReviewerVerdict } from "@sphynx/schema/review-queue";
import { ScoreBadge } from "@/components/dashboard/score-badge";
import { SignalTip } from "@/components/dashboard/signal-tip";
import { GithubProfile } from "@/components/github/github-profile";
import { VerdictIcon } from "@/components/pull-request/verdict-icon";
import { fullDate, shortAge } from "@/lib/age";
import { stripBotSuffix } from "@/lib/claims";
import { parseScoreRatio } from "@/lib/score";

const VERDICT_LABELS: Record<ReviewerVerdict["state"], string> = {
  approved: "approved",
  "changes-requested": "wants changes",
  commented: "commented",
};

interface VerdictRowProps {
  now: number;
  reviewer: ReviewerVerdict;
}

export function VerdictRow({ now, reviewer }: VerdictRowProps) {
  const name = stripBotSuffix(reviewer.name);
  const ratio = reviewer.score ? parseScoreRatio(reviewer.score) : null;
  return (
    <div className="-mx-4 flex h-11 items-center gap-2.5 px-4">
      <GithubProfile
        avatarUrl={reviewer.avatarUrl}
        className="min-w-0 flex-1"
        labelClassName="text-sm"
        link={false}
        login={name}
        shape="square"
        size="sm"
        stripBot={false}
      />
      {ratio !== null && reviewer.score ? (
        <SignalTip
          className="flex shrink-0 items-center gap-1"
          label={`Scored ${reviewer.score}`}
        >
          <ScoreBadge
            label={reviewer.score.split("/")[0] ?? ""}
            ratio={ratio}
          />
        </SignalTip>
      ) : null}
      <span
        className="w-8 shrink-0 text-right text-muted-foreground/60 text-xs tabular-nums"
        title={
          reviewer.submittedAt ? fullDate(reviewer.submittedAt) : undefined
        }
      >
        {reviewer.submittedAt ? shortAge(reviewer.submittedAt, now) : ""}
      </span>
      <SignalTip className="shrink-0" label={VERDICT_LABELS[reviewer.state]}>
        <VerdictIcon verdict={reviewer.state} />
      </SignalTip>
    </div>
  );
}
