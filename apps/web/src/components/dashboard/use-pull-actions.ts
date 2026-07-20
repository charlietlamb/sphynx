import type { QueuePull } from "@sphynx/schema/review-queue";
import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useSettings } from "@/components/settings/settings-provider";
import { logWorkbenchEvent } from "@/components/workbench/workbench-store";
import { isAccessBlocked, postJson } from "@/lib/api";
import { installationSettingsUrl } from "@/lib/github-app";
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

/**
 * A write GitHub refused for lack of permission needs a different response
 * from a transient failure: it will fail identically on every retry until the
 * installation is granted the missing access, so the toast links there.
 */
function reportWriteError(pull: QueuePull, action: string, error: unknown) {
  if (isAccessBlocked(error)) {
    toast.error(`Sphynx can't ${action} pull requests yet`, {
      description: `The GitHub App needs write access to ${pull.owner}/${pull.repo}.`,
      action: {
        label: "Review access",
        onClick: () => {
          window.open(installationSettingsUrl(pull.owner), "_blank");
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
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const confirm = (message: string, description: string) => {
    if (settings.confirmActions) {
      toast.success(message, { description });
    }
  };
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
    onError: (error, _input, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data);
      }
      reportWriteError(pull, "merge", error);
    },
    onSuccess: () => {
      logWorkbenchEvent({
        owner: pull.owner,
        repo: pull.repo,
        kind: "pr-merged",
        pull: { number: pull.number, title: pull.title },
      });
      confirm(`Merged #${pull.number}`, pull.title);
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
      confirm(`Requested changes on #${pull.number}`, pull.title);
      invalidate();
    },
    onError: (error) => reportWriteError(pull, "block", error),
  });

  return { merge, block };
}
