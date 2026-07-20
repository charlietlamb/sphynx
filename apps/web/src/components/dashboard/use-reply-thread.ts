import type { QueuePull } from "@sphynx/schema/review-queue";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { logWorkbenchEvent } from "@/components/workbench/workbench-store";
import { postJson } from "@/lib/api";

export function useReplyThread(pull: QueuePull) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { body: string; commentId: number }) =>
      postJson(
        `/api/github/repos/${pull.owner}/${pull.repo}/pulls/${pull.number}/comment-replies`,
        payload
      ),
    onSuccess: () => {
      logWorkbenchEvent({
        owner: pull.owner,
        repo: pull.repo,
        kind: "comment",
        pull: { number: pull.number, title: pull.title },
      });
      toast.success("Reply posted");
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
    onError: () =>
      toast.error("Couldn't post the reply", {
        description: "Nothing was changed on GitHub.",
      }),
  });
}
