import type { QueuePull } from "@sphynx/schema/review-queue";
import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { logWorkbenchEvent } from "@/components/workbench/workbench-store";
import { postJson } from "@/lib/api";
import { keys } from "@/lib/query/keys";

function pullPath(pull: QueuePull) {
  return `/api/github/repos/${pull.owner}/${pull.repo}/pulls/${pull.number}`;
}

const isSamePull = (a: QueuePull, b: QueuePull) =>
  a.owner === b.owner && a.repo === b.repo && a.number === b.number;

/**
 * Drops a merged pull from every cached queue and pipeline entry.
 *
 * Written against the whole installation branch because the queue and the
 * pipeline hold the same pull in two shapes, and the installation id is not
 * known at the call site.
 */
function removePullEverywhere(queryClient: QueryClient, pull: QueuePull) {
  queryClient.setQueriesData<{ repos: readonly RepoShape[] }>(
    { queryKey: [...keys.all, "installation"] },
    (current) =>
      current
        ? {
            ...current,
            repos: current.repos.map((repo) => ({
              ...repo,
              openPulls: repo.openPulls.filter(
                (candidate) => !isSamePull(candidate, pull)
              ),
            })),
          }
        : current
  );
}

interface RepoShape {
  readonly openPulls: readonly QueuePull[];
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
    /**
     * The row leaves the queue immediately. Without this it sat there until a
     * refetch that could take seconds, which read as the merge not working.
     */
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: [...keys.all, "installation"],
      });
      const previous = queryClient.getQueriesData({
        queryKey: [...keys.all, "installation"],
      });
      removePullEverywhere(queryClient, pull);
      return { previous };
    },
    onError: (_error, _input, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data);
      }
      toast.error(`Couldn't merge #${pull.number}`, {
        description: "Nothing was changed on GitHub.",
      });
    },
    onSuccess: () => {
      logWorkbenchEvent({
        owner: pull.owner,
        repo: pull.repo,
        kind: "pr-merged",
        pull: { number: pull.number, title: pull.title },
      });
    },
    onSettled: invalidate,
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
