import type { QueuePull } from "@sphynx/schema/review-queue";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { logWorkbenchEvent } from "@/components/workbench/workbench-store";
import { postJson } from "@/lib/api";
import { keys } from "@/lib/query/keys";

function pullPath(pull: QueuePull) {
  return `/api/github/repos/${pull.owner}/${pull.repo}/pulls/${pull.number}`;
}

export function usePullActions(pull: QueuePull) {
  const queryClient = useQueryClient();
  /**
   * Reaches the pull's own subtree and every installation-scoped view of it.
   * The installation id is not known here, so the whole installation branch is
   * invalidated rather than threading it through every call site.
   */
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.pull(pull) }),
      queryClient.invalidateQueries({
        queryKey: [...keys.all, "installation"],
      }),
    ]);

  const merge = useMutation({
    mutationKey: ["merge", pull.owner, pull.repo, pull.number],
    mutationFn: () => postJson(`${pullPath(pull)}/merge`),
    onSuccess: () => {
      logWorkbenchEvent({
        owner: pull.owner,
        repo: pull.repo,
        kind: "pr-merged",
        pull: { number: pull.number, title: pull.title },
      });
      invalidate();
    },
    onError: () =>
      toast.error(`Couldn't merge #${pull.number}`, {
        description: "Nothing was changed on GitHub.",
      }),
  });

  const block = useMutation({
    mutationKey: ["block", pull.owner, pull.repo, pull.number],
    mutationFn: (body: string) => postJson(`${pullPath(pull)}/block`, { body }),
    onSuccess: (_data, body) => {
      logWorkbenchEvent({
        owner: pull.owner,
        repo: pull.repo,
        kind: "review-changes",
        pull: { number: pull.number, title: pull.title },
        detail: body,
      });
      invalidate();
    },
    onError: () =>
      toast.error(`Couldn't block #${pull.number}`, {
        description: "Nothing was changed on GitHub.",
      }),
  });

  return { merge, block };
}
