import { api } from "@sphynx/backend/convex/_generated/api";
import type { QueuePull } from "@sphynx/schema/review-queue";
import { useMutation } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { toast } from "sonner";
import {
  forgetMerged,
  recordMerged,
} from "@/components/dashboard/pending-merges-store";
import { useSettings } from "@/components/settings/settings-provider";
import { logWorkbenchEvent } from "@/components/workbench/workbench-store";
import { trackEvent } from "@/lib/analytics";
import { isAccessBlocked } from "@/lib/api";
import { installationSettingsUrl } from "@/lib/github-app";

/**
 * A write GitHub refused for lack of permission needs a different response from
 * a transient failure: it will fail identically on every retry until the
 * installation is granted the missing access, so the toast links there.
 */
function reportWriteError(pull: QueuePull, action: string, error: unknown) {
  if (isAccessBlocked(error)) {
    toast.error(`Sphynx can't ${action} pull requests yet`, {
      description: `The GitHub App needs write access to ${pull.owner}/${pull.repo}.`,
      action: {
        label: "Review access",
        onClick: () => {
          window.open(
            installationSettingsUrl(pull.owner),
            "_blank",
            "noopener,noreferrer"
          );
        },
      },
      duration: 10_000,
    });
    return;
  }
  toast.error(`Couldn't ${action} #${pull.number}`, {
    description: "Nothing was changed on GitHub.",
  });
}

export function usePullActions(pull: QueuePull) {
  const { settings } = useSettings();
  const mergeAction = useAction(api.github.writes.merge);
  const blockAction = useAction(api.github.writes.block);

  const confirm = (message: string, description: string) => {
    if (settings.confirmActions) {
      toast.success(message, { description });
    }
  };

  /**
   * The row leaves the queue via a tombstone: GitHub confirms the merge before
   * its webhook updates the read model, so the live query in that ~1s window
   * still carries the pull. The tombstone suppresses it until a read no longer
   * carries it (reconcilePendingMerges), then it repaints itself.
   */
  const merge = useMutation({
    mutationFn: () =>
      mergeAction({ owner: pull.owner, repo: pull.repo, number: pull.number }),
    onMutate: () => recordMerged(pull),
    onError: (error) => {
      forgetMerged(pull);
      reportWriteError(pull, "merge", error);
    },
    onSuccess: () => {
      logWorkbenchEvent({
        owner: pull.owner,
        repo: pull.repo,
        kind: "pr-merged",
        pull: { number: pull.number, title: pull.title },
      });
      trackEvent("pull_merged", {
        owner: pull.owner,
        repo: pull.repo,
        number: pull.number,
      });
      confirm(`Merged #${pull.number}`, pull.title);
    },
  });

  const block = useMutation({
    mutationFn: (body: string) =>
      blockAction({
        owner: pull.owner,
        repo: pull.repo,
        number: pull.number,
        body,
      }),
    onSuccess: (_data, body) => {
      logWorkbenchEvent({
        owner: pull.owner,
        repo: pull.repo,
        kind: "review-changes",
        pull: { number: pull.number, title: pull.title },
        detail: body,
      });
      trackEvent("pull_blocked", {
        owner: pull.owner,
        repo: pull.repo,
        number: pull.number,
      });
      confirm(`Requested changes on #${pull.number}`, pull.title);
    },
    onError: (error) => reportWriteError(pull, "block", error),
  });

  return { merge, block };
}
