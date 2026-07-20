import {
  ArrowBendUpLeftIcon,
  ChatCircleIcon,
  CheckCircleIcon,
  GitPullRequestIcon,
} from "@phosphor-icons/react";
import type { QueuePull, ThreadPreview } from "@sphynx/schema/review-queue";
import { CopyButton } from "@sphynx/ui/components/copy-button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import { Button, buttonVariants } from "@sphynx/ui/components/ui/button";
import { cn } from "@sphynx/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { CopyForAgent } from "@/components/dashboard/copy-for-agent";
import { SignalTip } from "@/components/dashboard/signal-tip";
import {
  orderedThreadPreviews,
  splitSeverity,
  unresolvedThreadsText,
} from "@/components/dashboard/thread-copy-all";
import { ThreadReplyComposer } from "@/components/dashboard/thread-reply-composer";
import { HAIRLINE_DIVIDE } from "@/components/layout/dividers";
import { SectionHeader } from "@/components/layout/section-header";
import { FileTypeIcon } from "@/components/pull-request/file-type-icon";
import {
  useReplyToComment,
  useResolveThread,
} from "@/components/pull-request/pull-request-queries";
import { plural, stripBotSuffix } from "@/lib/claims";
import { baseName } from "@/lib/paths";

const SEVERITY_CLASSES: Record<string, string> = {
  P0: "bg-deletion/15 text-deletion ring-1 ring-deletion/30",
  P1: "bg-deletion/10 text-deletion",
  P2: "bg-amber-500/10 text-amber-500",
  P3: "bg-muted/60 text-muted-foreground",
};

function ThreadActionButton({
  disabled,
  icon,
  label,
  onClick,
}: {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <SignalTip label={label}>
      <Button
        aria-label={label}
        className="size-6"
        disabled={disabled}
        onClick={onClick}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        {icon}
      </Button>
    </SignalTip>
  );
}

function ThreadPreviewRow({
  canAct,
  preview,
  pull,
}: {
  canAct: boolean;
  preview: ThreadPreview;
  pull: QueuePull;
}) {
  const { resolve, resolving } = useResolveThread(pull);
  const { reply, replying: sendingReply } = useReplyToComment(pull);
  const login = preview.author ? stripBotSuffix(preview.author.login) : null;
  const [expanded, setExpanded] = useState(false);
  const [replying, setReplying] = useState(false);
  const { severity, text } = splitSeverity(preview.body);
  const canReply = canAct && preview.rootCommentId !== null;

  const submitReply = (body: string) => {
    if (preview.rootCommentId !== null) {
      reply({ body, commentId: preview.rootCommentId });
      setReplying(false);
    }
  };

  return (
    <div className="group/thread relative -mx-4 flex flex-col gap-1 px-4 py-2.5 transition-colors hover:bg-alpha-2">
      <button
        aria-expanded={expanded}
        aria-label="Expand the thread"
        className="absolute inset-0"
        onClick={() => setExpanded(!expanded)}
        type="button"
      />
      <div className="flex h-5 items-center gap-1.5">
        {preview.path ? (
          <FileTypeIcon className="size-3.5 shrink-0" path={preview.path} />
        ) : (
          <ChatCircleIcon
            className="size-3.5 shrink-0 text-muted-foreground/40"
            weight="fill"
          />
        )}
        {preview.path ? (
          <span
            className="min-w-0 truncate font-mono text-[11px] text-foreground/80"
            title={preview.path}
          >
            {baseName(preview.path)}
          </span>
        ) : null}
        <Avatar className="size-3.5 shrink-0 rounded-full">
          <AvatarImage
            alt={login ?? "unknown"}
            className="rounded-full"
            src={preview.author?.avatarUrl}
          />
          <AvatarFallback className="rounded-full text-[7px]">
            {login?.[0] ?? "?"}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 shrink-0 truncate text-[11px] text-muted-foreground">
          {login ?? "unknown"}
        </span>
        <span className="relative z-10 ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/thread:opacity-100">
          <CopyButton
            className="size-6"
            label="Copy comment"
            value={preview.body}
          />
          {canReply ? (
            <ThreadActionButton
              icon={<ArrowBendUpLeftIcon className="size-4" />}
              label="Reply"
              onClick={() => {
                setExpanded(true);
                setReplying(true);
              }}
            />
          ) : null}
          {canAct ? (
            <ThreadActionButton
              disabled={resolving}
              icon={<CheckCircleIcon className="size-4" />}
              label="Resolve"
              onClick={() => resolve({ resolved: true, threadId: preview.id })}
            />
          ) : null}
        </span>
      </div>
      <p
        className={cn(
          "text-pretty text-[12px] text-muted-foreground leading-snug",
          !expanded && "line-clamp-2"
        )}
      >
        {severity ? (
          <span
            className={cn(
              "mr-1.5 inline-block translate-y-[-1px] rounded-[4px] px-1 py-px align-middle font-medium font-mono text-[9px]",
              SEVERITY_CLASSES[severity]
            )}
          >
            {severity}
          </span>
        ) : null}
        {text}
      </p>
      {expanded ? (
        <div className="relative z-10 flex min-w-0 items-center gap-2.5 pt-1.5 pb-0.5">
          <Link
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-6 shrink-0 gap-1.5 px-2 text-xs"
            )}
            params={{
              owner: pull.owner,
              repo: pull.repo,
              number: pull.number,
            }}
            search={preview.path ? { file: preview.path } : undefined}
            to="/$owner/$repo/pull/$number"
          >
            <GitPullRequestIcon className="size-3.5" weight="fill" />
            Open in review
          </Link>
          {preview.path ? (
            <span className="min-w-0 truncate font-mono text-[10px] text-muted-foreground/50">
              {preview.path}
            </span>
          ) : null}
        </div>
      ) : null}
      {replying ? (
        <div className="relative z-10">
          <ThreadReplyComposer
            busy={sendingReply}
            onCancel={() => setReplying(false)}
            onSubmit={submitReply}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ThreadPreviews({
  canAct,
  pull,
}: {
  canAct: boolean;
  pull: QueuePull;
}) {
  if (pull.threadPreviews.length === 0) {
    return null;
  }
  const shown = orderedThreadPreviews(pull);
  const hidden = pull.unresolvedThreads - shown.length;
  return (
    <div className="flex flex-col px-4">
      <SectionHeader
        action={<CopyForAgent value={unresolvedThreadsText(pull)} />}
        icon={<ChatCircleIcon className="size-3" weight="fill" />}
        label="Open threads"
      />
      <div className={cn("flex flex-col", HAIRLINE_DIVIDE)}>
        {shown.map((preview) => (
          <ThreadPreviewRow
            canAct={canAct}
            key={preview.id}
            preview={preview}
            pull={pull}
          />
        ))}
      </div>
      {hidden > 0 ? (
        <p className="py-1.5 text-[11px] text-muted-foreground/50">
          +{plural(hidden, "more open thread")}
        </p>
      ) : null}
    </div>
  );
}
