import type { QueuePull } from "@sphynx/schema/review-queue";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postJson } from "@/lib/api";

function pullPath(pull: QueuePull) {
  return `/api/github/repos/${pull.owner}/${pull.repo}/pulls/${pull.number}`;
}

export function usePullActions(pull: QueuePull) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["pipeline"] });

  const merge = useMutation({
    mutationFn: () => postJson(`${pullPath(pull)}/merge`),
    onSuccess: invalidate,
  });

  const block = useMutation({
    mutationFn: (body: string) => postJson(`${pullPath(pull)}/block`, { body }),
    onSuccess: invalidate,
  });

  return { merge, block };
}
