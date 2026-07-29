import type { QueuePull } from "@sphynx/schema/review-queue";
import { Textarea } from "@sphynx/ui/components/ui/textarea";
import { useForm } from "@tanstack/react-form";
import { ConfirmActionDialog } from "@/components/dashboard/confirm-action-dialog";
import { useDialog } from "@/components/dashboard/dashboard-dialogs";
import { usePullActions } from "@/components/dashboard/use-pull-actions";

export function BlockPullDialog({ pull }: { pull: QueuePull }) {
  const { close } = useDialog();
  const { block } = usePullActions(pull);
  const form = useForm({
    defaultValues: { reason: "" },
    onSubmit: ({ value }) => {
      const reason = value.reason.trim();
      if (reason) {
        block.mutate(reason);
        close();
      }
    },
  });

  return (
    <form.Subscribe selector={(state) => state.values.reason.trim() !== ""}>
      {(hasReason) => (
        <ConfirmActionDialog
          confirmDisabled={!hasReason}
          confirmLabel="Request changes"
          description={`Submits a changes-requested review on ${pull.repo}#${pull.number} with your reason.`}
          onConfirm={form.handleSubmit}
          onOpenChange={(open) => {
            if (!open) {
              close();
            }
          }}
          open
          title={`Block #${pull.number} with changes requested?`}
        >
          <form.Field name="reason">
            {(field) => (
              <Textarea
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="What needs to change before this can merge?"
                value={field.state.value}
              />
            )}
          </form.Field>
        </ConfirmActionDialog>
      )}
    </form.Subscribe>
  );
}
