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
  const disabledTitle = canAct ? undefined : "sign in to act on pulls";

  return (
    <div className="flex flex-col gap-2 border-border border-t px-5 py-3">
      <div className="flex items-center justify-end gap-2">
        <ShortcutButton
          disabled={!canAct || block.isPending}
          onClick={() => dialogs.open("blockPull", { pull })}
          shortcut="b"
          size="sm"
          title={disabledTitle}
          variant="outline"
        >
          Block
        </ShortcutButton>
        <ShortcutButton
          disabled={!canAct || merge.isPending}
          onClick={() => dialogs.open("mergePull", { pull })}
          shortcut="m"
          size="sm"
          title={disabledTitle}
          variant="outline"
        >
          Merge
        </ShortcutButton>
        <ShortcutButton
          className="btn-primary-glow"
          onClick={onOpen}
          shortcut="p"
          size="sm"
        >
          Open pull
        </ShortcutButton>
      </div>
    </div>
  );
}
