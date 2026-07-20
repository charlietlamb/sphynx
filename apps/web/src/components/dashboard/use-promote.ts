import { CreatedPullSchema } from "@sphynx/schema/review-queue";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { logWorkbenchEvent } from "@/components/workbench/workbench-store";
import { postDecoded } from "@/lib/api";
import { keys } from "@/lib/query/keys";

interface PromoteInput {
  from: string;
  to: string;
}

export function usePromote(owner: string, repo: string) {
  const queryClient = useQueryClient();
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
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.repo({ owner, repo }) }),
        queryClient.invalidateQueries({
          queryKey: [...keys.all, "installation"],
        }),
      ]);
    },
  });
}
