import { CreatedPullSchema } from "@sphynx/schema/review-queue";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSettings } from "@/components/settings/settings-provider";
import { logWorkbenchEvent } from "@/components/workbench/workbench-store";
import { postDecoded } from "@/lib/api";
import { keys } from "@/lib/query/keys";

interface PromoteInput {
  from: string;
  to: string;
}

export function usePromote(owner: string, repo: string) {
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  return useMutation({
    mutationFn: ({ from, to }: PromoteInput) =>
      postDecoded(
        `/api/github/repos/${owner}/${repo}/promote`,
        CreatedPullSchema,
        { from, to }
      ),
    onSuccess: (created, { from, to }) => {
      logWorkbenchEvent({
        owner,
        repo,
        kind: "pr-opened",
        pull: { number: created.number, title: `Release ${from} to ${to}` },
      });
      if (settings.confirmActions) {
        toast.success(`Opened #${created.number}`, {
          description: `Release ${from} to ${to}`,
        });
      }
      /**
       * Refetch only the repo's own subtree. The installation queue/pipeline is
       * the webhook-lagged read model: refetching it now reads the model before
       * the `opened` webhook has materialized the new pull, so the just-created
       * PR would briefly be absent from the queue. The SSE `dirty` signal brings
       * it in once the row actually lands.
       */
      queryClient.invalidateQueries({ queryKey: keys.repo({ owner, repo }) });
    },
  });
}
