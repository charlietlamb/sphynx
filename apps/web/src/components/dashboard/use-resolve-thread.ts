import type { QueuePull } from "@sphynx/schema/review-queue";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { logWorkbenchEvent } from "@/components/workbench/workbench-store";
import { postJson } from "@/lib/api";

export function useResolveThread(pull: QueuePull) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) =>
      postJson(
        `/api/github/repos/${pull.owner}/${pull.repo}/pulls/${pull.number}/comment-threads/resolve`,
        { threadId, resolved: true }
      ),
    onSuccess: () => {
      logWorkbenchEvent({
        owner: pull.owner,
        repo: pull.repo,
        kind: "thread-resolved",
        pull: { number: pull.number, title: pull.title },
      });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
    onError: () =>
      toast.error("Couldn't resolve the thread", {
        description: "Nothing was changed on GitHub.",
      }),
  });
}
