import {
  GitMergeIcon,
  GitPullRequestIcon,
  ProhibitIcon,
} from "@phosphor-icons/react";
import type { QueuePull } from "@sphynx/schema/review-queue";
import { ShortcutButton } from "@sphynx/ui/components/shortcut-button";
import { useDialog } from "@/components/dashboard/dashboard-dialogs";
import { usePullActions } from "@/components/dashboard/use-pull-actions";

interface DossierActionsProps {
  canAct: boolean;
  onOpen: () => void;
  pull: QueuePull;
}

export function DossierActions({ canAct, onOpen, pull }: DossierActionsProps) {
  const dialogs = useDialog();
  const { merge, block } = usePullActions(pull);
  const isOpen = pull.state === "open";
  const canDecide = canAct && isOpen;
  const blockedReason = isOpen ? undefined : `already ${pull.state}`;
  const disabledTitle =
    blockedReason ?? (canAct ? undefined : "sign in to act on pulls");

  return (
    <div className="mt-auto flex flex-col gap-2 border-border border-t bg-background px-4 py-3">
      <div className="flex items-center justify-end gap-2">
        <ShortcutButton
          disabled={!canDecide || block.isPending}
          onClick={() => dialogs.open("blockPull", { pull })}
          shortcut="b"
          size="sm"
          title={disabledTitle}
          variant="outline"
        >
          <ProhibitIcon className="size-3.5" weight="fill" />
          Block
        </ShortcutButton>
        <ShortcutButton
          disabled={!canDecide || merge.isPending}
          onClick={() => dialogs.open("mergePull", { pull })}
          shortcut="m"
          size="sm"
          title={disabledTitle}
          variant="outline"
        >
          <GitMergeIcon className="size-3.5" weight="fill" />
          Merge
        </ShortcutButton>
        <ShortcutButton
          className="btn-primary-glow flex-1"
          onClick={onOpen}
          shortcut="p"
          size="sm"
        >
          <GitPullRequestIcon className="size-3.5" weight="fill" />
          Open pull
        </ShortcutButton>
      </div>
    </div>
  );
}
