import type { QueuePull } from "@sphynx/schema/review-queue";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { postJson } from "@/lib/api";

function pullPath(pull: QueuePull) {
  return `/api/github/repos/${pull.owner}/${pull.repo}/pulls/${pull.number}`;
}

export function usePullActions(pull: QueuePull) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["pipeline"] });

  const merge = useMutation({
    mutationKey: ["merge", pull.owner, pull.repo, pull.number],
    mutationFn: () => postJson(`${pullPath(pull)}/merge`),
    onSuccess: invalidate,
    onError: () =>
      toast.error(`Couldn't merge #${pull.number}`, {
        description: "Nothing was changed on GitHub.",
      }),
  });

  const block = useMutation({
    mutationKey: ["block", pull.owner, pull.repo, pull.number],
    mutationFn: (body: string) => postJson(`${pullPath(pull)}/block`, { body }),
    onSuccess: invalidate,
    onError: () =>
      toast.error(`Couldn't block #${pull.number}`, {
        description: "Nothing was changed on GitHub.",
      }),
  });

  return { merge, block };
}
