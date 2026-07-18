import type { QueuePull } from "@sphynx/schema/review-queue";
import { ShortcutButton } from "@sphynx/ui/components/shortcut-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@sphynx/ui/components/ui/alert-dialog";
import { Textarea } from "@sphynx/ui/components/ui/textarea";
import { useState } from "react";
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
  return (
    <div className="mt-auto flex flex-col gap-2 border-border border-t px-5 py-3">
      {merge.isError || block.isError ? (
        <p className="text-[12px] text-deletion">
          Something went wrong — nothing was changed on GitHub.
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <ShortcutButton
          disabled={!canAct || block.isPending}
          onClick={() => onDialogChange("block")}
          shortcut="b"
          size="sm"
          title={disabledTitle}
          variant="outline"
        >
          Block
        </ShortcutButton>
        <ShortcutButton
          disabled={!canAct || merge.isPending}
          onClick={() => onDialogChange("merge")}
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
      <AlertDialog
        onOpenChange={(open) => onDialogChange(open ? "block" : null)}
        open={dialog === "block"}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Block #{pull.number} with changes requested?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Submits a changes-requested review on {pull.repo}#{pull.number}{" "}
              with your reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            onChange={(event) => setReason(event.target.value)}
            placeholder="What needs to change before this can merge?"
            value={reason}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={reason.trim().length === 0}
              onClick={() => {
                block.mutate(reason.trim());
                onDialogChange(null);
              }}
            >
              Request changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        onOpenChange={(open) => onDialogChange(open ? "merge" : null)}
        open={dialog === "merge"}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Merge #{pull.number} into {pull.baseRefName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Squash-merges {pull.repo}#{pull.number} on GitHub. This can't be
              undone from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                merge.mutate();
                onDialogChange(null);
              }}
            >
              Merge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
