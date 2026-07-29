import { GitMergeIcon } from "@phosphor-icons/react";
import type { PullRequestSummary } from "@sphynx/schema/pull-requests";
import { ShortcutButton } from "@sphynx/ui/components/shortcut-button";
import { useHotkey } from "@sphynx/ui/hooks/use-hotkey";
import { useCallback, useState } from "react";
import { ConfirmActionDialog } from "@/components/dashboard/confirm-action-dialog";
import { useMergePullRequest } from "@/components/pull-request/pull-request-queries";

interface PullRequestMergeButtonProps {
  canAct: boolean;
  pullRequest: PullRequestSummary;
}

export function PullRequestMergeButton({
  canAct,
  pullRequest,
}: PullRequestMergeButtonProps) {
  const [open, setOpen] = useState(false);
  const { merge, merging } = useMergePullRequest({
    owner: pullRequest.repository.owner,
    repo: pullRequest.repository.name,
    number: pullRequest.number,
  });

  const mergeable =
    canAct && pullRequest.state === "open" && !pullRequest.draft;

  useHotkey(
    "m",
    useCallback(() => setOpen(true), []),
    { enabled: mergeable }
  );

  if (pullRequest.state !== "open" || pullRequest.draft) {
    return null;
  }

  const confirmMerge = () => {
    merge();
    setOpen(false);
  };

  return (
    <>
      <ShortcutButton
        className="btn-primary-glow h-8 gap-1.5 text-xs"
        disabled={!canAct || merging}
        onClick={() => setOpen(true)}
        shortcut="M"
        size="sm"
        title={canAct ? undefined : "Sign in to merge"}
      >
        <GitMergeIcon className="size-3.5" weight="fill" />
        Merge
      </ShortcutButton>
      <ConfirmActionDialog
        confirmDisabled={merging}
        confirmLabel={`Merge #${pullRequest.number}`}
        description={`${pullRequest.head.ref} will be merged into ${pullRequest.base.ref}. This cannot be undone.`}
        onConfirm={confirmMerge}
        onOpenChange={setOpen}
        open={open}
        title={`Merge #${pullRequest.number}?`}
      />
    </>
  );
}
