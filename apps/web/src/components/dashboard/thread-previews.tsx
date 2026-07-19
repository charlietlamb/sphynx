import { ChatCircleIcon } from "@phosphor-icons/react";
import type { QueuePull, ThreadPreview } from "@sphynx/schema/review-queue";
import { CopyButton } from "@sphynx/ui/components/copy-button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import { cn } from "@sphynx/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { CopyForAgent } from "@/components/dashboard/copy-for-agent";
import {
  orderedThreadPreviews,
  splitSeverity,
  unresolvedThreadsText,
} from "@/components/dashboard/thread-copy-all";
import { useResolveThread } from "@/components/dashboard/use-resolve-thread";
import { SectionHeader } from "@/components/layout/section-header";
import { plural, stripBotSuffix } from "@/lib/claims";
import { baseName } from "@/lib/paths";

const SEVERITY_CLASSES: Record<string, string> = {
  P0: "text-deletion",
  P1: "text-deletion",
  P2: "text-amber-500",
  P3: "text-muted-foreground",
};

function ThreadPreviewRow({
  canAct,
  preview,
  pull,
}: {
  canAct: boolean;
  preview: ThreadPreview;
  pull: QueuePull;
}) {
  const resolve = useResolveThread(pull);
  const login = preview.author ? stripBotSuffix(preview.author.login) : null;
  const [expanded, setExpanded] = useState(false);
  const { severity, text } = splitSeverity(preview.body);
  return (
    <div className="group relative -mx-2 flex flex-col gap-1 rounded-md px-2 py-1.5 transition-colors hover:bg-alpha-2">
      <button
        aria-expanded={expanded}
        aria-label="Expand the thread"
        className="absolute inset-0 rounded-md"
        onClick={() => setExpanded(!expanded)}
        type="button"
      />
      <div className="flex h-5 items-center gap-1.5">
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
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {login ?? "unknown"}
        </span>
        {preview.path ? (
          <span
            className="min-w-0 truncate font-mono text-[10px] text-muted-foreground/50"
            title={preview.path}
          >
            {baseName(preview.path)}
          </span>
        ) : null}
        <span className="relative z-10 ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <CopyButton
            className="size-6"
            label="Copy comment"
            value={preview.body}
          />
          {canAct ? (
            <button
              className="flex h-6 items-center rounded-md px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-alpha-4 hover:text-foreground disabled:opacity-50"
              disabled={resolve.isPending}
              onClick={() => resolve.mutate(preview.id)}
              type="button"
            >
              {resolve.isPending ? "resolving…" : "resolve"}
            </button>
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
              "mr-1.5 font-medium font-mono text-[10px]",
              SEVERITY_CLASSES[severity]
            )}
          >
            {severity}
          </span>
        ) : null}
        {text}
      </p>
      {expanded ? (
        <div className="relative z-10 flex min-w-0 items-center gap-3 pt-0.5">
          <Link
            className="shrink-0 text-[11px] text-primary underline-offset-2 hover:underline"
            params={{
              owner: pull.owner,
              repo: pull.repo,
              number: pull.number,
            }}
            search={preview.path ? { file: preview.path } : undefined}
            to="/$owner/$repo/pull/$number"
          >
            open in review
          </Link>
          {preview.path ? (
            <span className="min-w-0 truncate font-mono text-[10px] text-muted-foreground/50">
              {preview.path}
            </span>
          ) : null}
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
    <div className="flex flex-col gap-1 px-5 pb-3">
      <SectionHeader
        action={<CopyForAgent value={unresolvedThreadsText(pull)} />}
        icon={<ChatCircleIcon className="size-3" weight="fill" />}
        label="Open threads"
      />
      <div className="-mx-2 flex flex-col gap-1 px-2">
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
        <p className="text-[11px] text-muted-foreground/50">
          +{plural(hidden, "more open thread")}
        </p>
      ) : null}
    </div>
  );
}
