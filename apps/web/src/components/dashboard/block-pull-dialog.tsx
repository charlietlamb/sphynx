import type { QueuePull } from "@sphynx/schema/review-queue";
import { Textarea } from "@sphynx/ui/components/ui/textarea";
import { useState } from "react";
import { ConfirmActionDialog } from "@/components/dashboard/confirm-action-dialog";
import { useDialog } from "@/components/dashboard/dashboard-dialogs";
import { usePullActions } from "@/components/dashboard/use-pull-actions";

export function BlockPullDialog({ pull }: { pull: QueuePull }) {
  const { close } = useDialog();
  const { block } = usePullActions(pull);
  const [reason, setReason] = useState("");

  const confirm = () => {
    if (reason.trim().length === 0) {
      return;
    }
    block.mutate(reason.trim());
    close();
  };

  return (
    <ConfirmActionDialog
      confirmDisabled={reason.trim().length === 0}
      confirmLabel="Request changes"
      description={`Submits a changes-requested review on ${pull.repo}#${pull.number} with your reason.`}
      onConfirm={confirm}
      onOpenChange={(open) => {
        if (!open) {
          close();
        }
      }}
      open
      title={`Block #${pull.number} with changes requested?`}
    >
      <Textarea
        onChange={(event) => setReason(event.target.value)}
        placeholder="What needs to change before this can merge?"
        value={reason}
      />
    </ConfirmActionDialog>
  );
}
