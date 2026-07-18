import { CreatedPullSchema } from "@sphynx/schema/review-queue";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postDecoded } from "@/lib/api";

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pipeline"] }),
  });
}
