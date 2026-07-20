import {
  ChatCircleIcon,
  CheckCircleIcon,
  FilesIcon,
  GitCommitIcon,
  SealCheckIcon,
  SquaresFourIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import type { ReviewThread } from "@sphynx/schema/pull-request-comments";
import type { ConversationReview } from "@sphynx/schema/pull-request-conversation";
import type {
  GitHubUser,
  PullRequestSummary,
} from "@sphynx/schema/pull-requests";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import { cn } from "@sphynx/ui/lib/utils";
import type { ReactNode } from "react";
import { SignalTip } from "@/components/dashboard/signal-tip";
import { HAIRLINE_DIVIDE } from "@/components/layout/dividers";
import { SectionHeader } from "@/components/layout/section-header";
import { DiffStat } from "@/components/pull-request/diff-stat";
import { FileTypeIcon } from "@/components/pull-request/file-type-icon";
import { VerdictIcon } from "@/components/pull-request/verdict-icon";
import { fullDate, shortAge } from "@/lib/age";
import { plural } from "@/lib/claims";

interface OverviewThreadItem {
  key: string;
  thread: ReviewThread;
}

interface ConversationOverviewProps {
  now: number;
  onFocusThread: (key: string) => void;
  participants: readonly GitHubUser[];
  reviewers: readonly ConversationReview[];
  summary: PullRequestSummary;
  threadItems: readonly OverviewThreadItem[];
}

const MAX_PARTICIPANTS = 8;

export function ConversationOverview({
  now,
  onFocusThread,
  participants,
  reviewers,
  summary,
  threadItems,
}: ConversationOverviewProps) {
  const { stats } = summary;
  const open = threadItems.filter((item) => !item.thread.isResolved);
  const resolved = threadItems.length - open.length;
  const shownParticipants = participants.slice(0, MAX_PARTICIPANTS);
  const hiddenParticipants = participants.length - shownParticipants.length;
  return (
    <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-2 border-border border-b px-4 pb-2">
        <SectionHeader
          icon={<SquaresFourIcon className="size-3" weight="fill" />}
          label="Overview"
        />
        <div className="flex items-center gap-5 py-0.5">
          <StatGlyph
            icon={<GitCommitIcon className="size-3.5" weight="fill" />}
            label={plural(stats.commits, "commit")}
            value={stats.commits}
          />
          <StatGlyph
            icon={<FilesIcon className="size-3.5" weight="fill" />}
            label={plural(stats.changedFiles, "changed file")}
            value={stats.changedFiles}
          />
          <StatGlyph
            icon={<ChatCircleIcon className="size-3.5" weight="fill" />}
            label={plural(stats.comments + stats.reviewComments, "comment")}
            value={stats.comments + stats.reviewComments}
          />
          <span className="ml-auto">
            <DiffStat additions={stats.additions} deletions={stats.deletions} />
          </span>
        </div>
        <span className="flex h-[3px] gap-[1.5px] overflow-hidden rounded-full">
          {stats.additions > 0 ? (
            <span
              className="rounded-full bg-addition"
              style={{ flexGrow: stats.additions }}
            />
          ) : null}
          {stats.deletions > 0 ? (
            <span
              className="rounded-full bg-deletion"
              style={{ flexGrow: stats.deletions }}
            />
          ) : null}
        </span>
      </div>
      {open.length > 0 || resolved > 0 ? (
        <div className="flex flex-col border-border border-b px-4">
          <SectionHeader
            action={
              <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                {open.length}
              </span>
            }
            icon={<ChatCircleIcon className="size-3" weight="fill" />}
            label="Open threads"
          />
          <div className={cn("flex flex-col", HAIRLINE_DIVIDE)}>
            {open.map((item) => {
              const lastComment = item.thread.comments.at(-1);
              return (
                <SignalTip
                  className="-mx-4 block"
                  key={item.key}
                  label={`${item.thread.path}:${item.thread.line}`}
                >
                  <button
                    className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-alpha-2"
                    onClick={() => onFocusThread(item.key)}
                    type="button"
                  >
                    <FileTypeIcon
                      className="size-3.5 shrink-0"
                      path={item.thread.path}
                    />
                    <span className="min-w-0 truncate font-mono text-[11px] text-foreground/80">
                      {basename(item.thread.path)}
                      <span className="text-muted-foreground/50">
                        :{item.thread.line}
                      </span>
                    </span>
                    {lastComment ? (
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground/60 tabular-nums">
                        {shortAge(lastComment.createdAt, now)}
                      </span>
                    ) : null}
                  </button>
                </SignalTip>
              );
            })}
            {resolved > 0 ? (
              <div className="-mx-4 flex items-center gap-2 px-4 py-2">
                <CheckCircleIcon
                  className="size-3.5 shrink-0 text-muted-foreground/40"
                  weight="fill"
                />
                <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                  {resolved} resolved
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {reviewers.length > 0 ? (
        <div className="flex flex-col border-border border-b px-4">
          <SectionHeader
            icon={<SealCheckIcon className="size-3" weight="fill" />}
            label="Reviewers"
          />
          <div className={cn("flex flex-col", HAIRLINE_DIVIDE)}>
            {reviewers.map((review) => (
              <div
                className="-mx-4 flex items-center gap-2 px-4 py-2"
                key={review.id}
              >
                <Avatar className="size-4 rounded-full">
                  <AvatarImage
                    alt={review.author?.login ?? "unknown"}
                    src={review.author?.avatarUrl}
                  />
                  <AvatarFallback className="text-[8px]">
                    {review.author?.login[0] ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 truncate text-[12px] text-foreground">
                  {review.author?.login ?? "unknown"}
                </span>
                <span
                  className="ml-auto text-[11px] text-muted-foreground/60 tabular-nums"
                  title={fullDate(review.submittedAt)}
                >
                  {shortAge(review.submittedAt, now)}
                </span>
                <VerdictIcon verdict={review.verdict} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {participants.length > 0 ? (
        <div className="flex flex-col gap-2 border-border border-b px-4 pb-2">
          <SectionHeader
            icon={<UsersIcon className="size-3" weight="fill" />}
            label="Participants"
          />
          <div className="flex items-center">
            <div className="flex -space-x-1.5">
              {shownParticipants.map((participant) => (
                <SignalTip key={participant.login} label={participant.login}>
                  <Avatar className="size-5 rounded-full ring-2 ring-background">
                    <AvatarImage
                      alt={participant.login}
                      src={participant.avatarUrl}
                    />
                    <AvatarFallback className="text-[8px]">
                      {participant.login[0]}
                    </AvatarFallback>
                  </Avatar>
                </SignalTip>
              ))}
            </div>
            {hiddenParticipants > 0 ? (
              <span className="ml-2 text-[11px] text-muted-foreground/60 tabular-nums">
                +{hiddenParticipants}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function basename(path: string) {
  return path.split("/").at(-1) ?? path;
}

function StatGlyph({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <SignalTip className="flex items-center gap-1.5" label={label}>
      <span className="text-muted-foreground/60">{icon}</span>
      <span className="text-[12px] text-foreground tabular-nums">{value}</span>
    </SignalTip>
  );
}
