import { useMutation, useQueryClient } from "@tanstack/react-query";

interface PromoteInput {
  from: string;
  to: string;
}

export function usePromote(owner: string, repo: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ from, to }: PromoteInput) => {
      const response = await fetch(
        `/api/github/repos/${owner}/${repo}/promote`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ from, to }),
        }
      );
      if (!response.ok) {
        throw new Error(`release pr failed (${response.status})`);
      }
      return response.json() as Promise<{ number: number }>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pipeline"] }),
  });
}
