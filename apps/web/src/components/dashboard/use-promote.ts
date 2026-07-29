import { api } from "@sphynx/backend/convex/_generated/api";
import { useMutation } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { useSettings } from "@/components/settings/settings-provider";
import { logWorkbenchEvent } from "@/components/workbench/workbench-store";

interface PromoteInput {
  from: string;
  to: string;
}

export function usePromote(owner: string, repo: string) {
  const { settings } = useSettings();
  const promoteAction = useAction(api.github.writes.promote);
  return useMutation({
    mutationFn: ({ from, to }: PromoteInput) =>
      promoteAction({
        owner,
        repo,
        from,
        to,
        title: `Release ${from} to ${to}`,
      }),
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
    },
  });
}
