import type { QueuePull } from "@sphynx/schema/review-queue";
import { ShortcutButton } from "@sphynx/ui/components/shortcut-button";
import { Textarea } from "@sphynx/ui/components/ui/textarea";
import { useState } from "react";
import { ConfirmActionDialog } from "@/components/dashboard/confirm-action-dialog";
import { usePullActions } from "@/components/dashboard/use-pull-actions";

export type ActionDialog = "merge" | "block" | null;

interface DossierActionsProps {
  canAct: boolean;
  dialog: ActionDialog;
  onDialogChange: (dialog: ActionDialog) => void;
  onOpen: () => void;
  pull: QueuePull;
}

export function DossierActions({
  canAct,
  dialog,
  onDialogChange,
  onOpen,
  pull,
}: DossierActionsProps) {
  const { merge, block } = usePullActions(pull);
  const [reason, setReason] = useState("");
  const disabledTitle = canAct ? undefined : "sign in to act on pulls";

  const changeDialog = (next: ActionDialog) => {
    if (next === null) {
      setReason("");
    }
    onDialogChange(next);
  };

  const confirmBlock = () => {
    if (reason.trim().length === 0) {
      return;
    }
    block.mutate(reason.trim());
    changeDialog(null);
  };

  const confirmMerge = () => {
    merge.mutate();
    changeDialog(null);
  };

  return (
    <div className="flex flex-col gap-2 border-border border-t px-5 py-3">
      {merge.isError || block.isError ? (
        <p className="text-[12px] text-deletion">
          Nothing was changed on GitHub.
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <ShortcutButton
          disabled={!canAct || block.isPending}
          onClick={() => changeDialog("block")}
          shortcut="b"
          size="sm"
          title={disabledTitle}
          variant="outline"
        >
          Block
        </ShortcutButton>
        <ShortcutButton
          disabled={!canAct || merge.isPending}
          onClick={() => changeDialog("merge")}
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
      <ConfirmActionDialog
        confirmDisabled={reason.trim().length === 0}
        confirmLabel="Request changes"
        description={`Submits a changes-requested review on ${pull.repo}#${pull.number} with your reason.`}
        onConfirm={confirmBlock}
        onOpenChange={(open) => changeDialog(open ? "block" : null)}
        open={dialog === "block"}
        title={`Block #${pull.number} with changes requested?`}
      >
        <Textarea
          onChange={(event) => setReason(event.target.value)}
          placeholder="What needs to change before this can merge?"
          value={reason}
        />
      </ConfirmActionDialog>
      <ConfirmActionDialog
        confirmLabel="Merge"
        description={`Squash-merges ${pull.repo}#${pull.number} on GitHub. This can't be undone from here.`}
        onConfirm={confirmMerge}
        onOpenChange={(open) => changeDialog(open ? "merge" : null)}
        open={dialog === "merge"}
        title={`Merge #${pull.number} into ${pull.baseRefName}?`}
      />
    </div>
  );
}
