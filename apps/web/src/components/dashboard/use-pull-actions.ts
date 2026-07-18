import type { QueuePull } from "@sphynx/schema/review-queue";
import { useMutation, useQueryClient } from "@tanstack/react-query";

function pullPath(pull: QueuePull) {
  return `/api/github/repos/${pull.owner}/${pull.repo}/pulls/${pull.number}`;
}

async function postAction(url: string, payload?: object) {
  const response = await fetch(url, {
    method: "POST",
    headers: payload ? { "content-type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!response.ok) {
    throw new Error(`action failed (${response.status})`);
  }
  return response.json();
}

export function usePullActions(pull: QueuePull) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["pipeline"] });

  const merge = useMutation({
    mutationFn: () => postAction(`${pullPath(pull)}/merge`),
    onSuccess: invalidate,
  });

  const block = useMutation({
    mutationFn: (body: string) =>
      postAction(`${pullPath(pull)}/block`, { body }),
    onSuccess: invalidate,
  });

  return { merge, block };
}
