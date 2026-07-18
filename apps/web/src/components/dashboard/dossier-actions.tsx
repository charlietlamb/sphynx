import type { QueuePull } from "@sphynx/schema/review-queue";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@sphynx/ui/components/ui/alert-dialog";
import { Button } from "@sphynx/ui/components/ui/button";
import { Textarea } from "@sphynx/ui/components/ui/textarea";
import { useState } from "react";
import { usePullActions } from "@/components/dashboard/use-pull-actions";

interface DossierActionsProps {
  canAct: boolean;
  onOpen: () => void;
  pull: QueuePull;
}

export function DossierActions({ canAct, onOpen, pull }: DossierActionsProps) {
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
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                disabled={!canAct || block.isPending}
                size="sm"
                title={disabledTitle}
                variant="outline"
              >
                Block
              </Button>
            }
          />
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
                onClick={() => block.mutate(reason.trim())}
              >
                Request changes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                disabled={!canAct || merge.isPending}
                size="sm"
                title={disabledTitle}
                variant="outline"
              >
                Merge
              </Button>
            }
          />
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
              <AlertDialogAction onClick={() => merge.mutate()}>
                Merge
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button className="btn-primary-glow" onClick={onOpen} size="sm">
          Open pull
        </Button>
      </div>
    </div>
  );
}
