import type { QueuePull } from "@sphynx/schema/review-queue";
import { ConfirmActionDialog } from "@/components/dashboard/confirm-action-dialog";
import { useDialog } from "@/components/dashboard/dashboard-dialogs";
import { usePullActions } from "@/components/dashboard/use-pull-actions";

export function MergePullDialog({ pull }: { pull: QueuePull }) {
  const { close } = useDialog();
  const { merge } = usePullActions(pull);
  return (
    <ConfirmActionDialog
      confirmLabel="Merge"
      description={`Squash-merges ${pull.repo}#${pull.number} on GitHub. This can't be undone from here.`}
      onConfirm={() => {
        merge.mutate();
        close();
      }}
      onOpenChange={(open) => {
        if (!open) {
          close();
        }
      }}
      open
      title={`Merge #${pull.number} into ${pull.baseRefName}?`}
    />
  );
}
