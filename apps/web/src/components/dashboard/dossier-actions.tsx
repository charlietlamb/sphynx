import {
  GitMergeIcon,
  GitPullRequestIcon,
  ProhibitIcon,
} from "@phosphor-icons/react";
import type { QueuePull } from "@sphynx/schema/review-queue";
import { useDialog } from "@/components/dashboard/dashboard-dialogs";
import { IconAction } from "@/components/dashboard/icon-action";
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
    <div className="flex shrink-0 items-center gap-1.5">
      <IconAction
        disabled={!canDecide || block.isPending}
        icon={<ProhibitIcon className="size-[1.125rem]" weight="fill" />}
        label="Block"
        onClick={() => dialogs.open("blockPull", { pull })}
        shortcut="B"
        title={disabledTitle}
      />
      <IconAction
        disabled={!canDecide || merge.isPending}
        icon={<GitMergeIcon className="size-[1.125rem]" weight="fill" />}
        label="Merge"
        onClick={() => dialogs.open("mergePull", { pull })}
        shortcut="M"
        title={disabledTitle}
      />
      <IconAction
        className="btn-primary-glow"
        icon={<GitPullRequestIcon className="size-[1.125rem]" weight="fill" />}
        label="Open pull"
        onClick={onOpen}
        shortcut="P"
        variant="default"
      />
    </div>
  );
}
