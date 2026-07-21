import type { QueuePull } from "@sphynx/schema/review-queue";
import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  forgetMerged,
  recordMerged,
} from "@/components/dashboard/pending-merges-store";
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
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const confirm = (message: string, description: string) => {
    if (settings.confirmActions) {
      toast.success(message, { description });
    }
  };

  const merge = useMutation({
    mutationKey: ["merge", pull.owner, pull.repo, pull.number],
    mutationFn: () => postJson(`${pullPath(pull)}/merge`),
    /**
     * The row leaves the queue immediately. Without this it sat there until a
     * refetch that could take seconds, which read as the merge not working.
     *
     * A tombstone keeps it gone: GitHub confirms the merge before its webhook
     * updates the read model, so any refetch in that ~1s window would return
     * the pull as still open and resurrect it. The tombstone suppresses it
     * until a read no longer carries it. No `onSettled` invalidate — refetching
     * before the model catches up is exactly what caused the resurrection; the
     * SSE `dirty` signal invalidates once the merge has actually landed.
     */
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: [...keys.all, "installation"],
      });
      const previous = queryClient.getQueriesData({
        queryKey: [...keys.all, "installation"],
      });
      recordMerged(pull);
      removePullEverywhere(queryClient, pull);
      return { previous };
    },
    onError: (error, _input, context) => {
      forgetMerged(pull);
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
  });

  const block = useMutation({
    mutationKey: ["block", pull.owner, pull.repo, pull.number],
    mutationFn: (body: string) => postJson(`${pullPath(pull)}/block`, { body }),
    /**
     * Refetch only the pull's own subtree — that reads live from GitHub and
     * reflects the review at once. The installation queue/pipeline is the
     * webhook-lagged read model, so refetching it here would read the pre-review
     * `ready` state and flicker the row back for ~1s; the SSE `dirty` signal
     * repaints it once the review webhook has actually materialized.
     */
    onSuccess: (_data, body) => {
      logWorkbenchEvent({
        owner: pull.owner,
        repo: pull.repo,
        kind: "review-changes",
        pull: { number: pull.number, title: pull.title },
        detail: body,
      });
      confirm(`Requested changes on #${pull.number}`, pull.title);
      queryClient.invalidateQueries({ queryKey: keys.pull(pull) });
    },
    onError: (error) => reportWriteError(pull, "block", error),
  });

  return { merge, block };
}
