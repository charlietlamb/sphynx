import type { QueuePull } from "@sphynx/schema/review-queue";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { postJson } from "@/lib/api";

export function useResolveThread(pull: QueuePull) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) =>
      postJson(
        `/api/github/repos/${pull.owner}/${pull.repo}/pulls/${pull.number}/comment-threads/resolve`,
        { threadId, resolved: true }
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pipeline"] }),
    onError: () =>
      toast.error("Couldn't resolve the thread", {
        description: "Nothing was changed on GitHub.",
      }),
  });
}
