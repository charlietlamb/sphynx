import { api } from "@sphynx/backend/convex/_generated/api";
import { useMutation } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { useSettings } from "@/components/settings/settings-provider";
import { isAccessBlocked } from "@/lib/access-block";
import { installationSettingsUrl } from "@/lib/github-app";

interface BackflowRepo {
  from: string;
  owner: string;
  repo: string;
  to: string;
}

function reportBackflowError(owner: string, action: string, error: unknown) {
  if (isAccessBlocked(error)) {
    toast.error(`Sphynx can't ${action} pull requests yet`, {
      description: `The GitHub App needs write access to ${owner}.`,
      action: {
        label: "Review access",
        onClick: () => {
          window.open(
            installationSettingsUrl(owner),
            "_blank",
            "noopener,noreferrer"
          );
        },
      },
      duration: 10_000,
    });
    return;
  }
  toast.error(`Couldn't ${action} the sync`, {
    description: "Nothing was changed on GitHub.",
  });
}

/**
 * The backflow control's two writes: open a `from → to` sync pull (e.g.
 * main → dev after a hotfix), then merge it once open. Both reuse the same
 * promote/merge actions the upward promotion rail uses, so a backmerge is just
 * an ordinary pull the read model already tracks — nothing new on the backend.
 */
export function useBackflow({ owner, repo, from, to }: BackflowRepo) {
  const { settings } = useSettings();
  const promoteAction = useAction(api.github.writes.promote);
  const mergeAction = useAction(api.github.writes.merge);

  const open = useMutation({
    mutationFn: () =>
      promoteAction({
        owner,
        repo,
        from,
        to,
        title: `Sync ${from} into ${to}`,
      }),
    onSuccess: (created) => {
      if (settings.confirmActions) {
        toast.success(`Opened #${created.number}`, {
          description: `Sync ${from} into ${to}`,
        });
      }
    },
    onError: (error) => reportBackflowError(owner, "open", error),
  });

  const merge = useMutation({
    // A backflow must merge as a real merge commit, not a squash: squashing the
    // sync leaves the source branch perpetually ahead of the target by commit
    // graph, so the sync-down prompt would never clear.
    mutationFn: (number: number) =>
      mergeAction({ owner, repo, number, method: "merge" }),
    onSuccess: (_data, number) => {
      if (settings.confirmActions) {
        toast.success(`Merged #${number}`, {
          description: `Synced ${from} into ${to}`,
        });
      }
    },
    onError: (error) => reportBackflowError(owner, "merge", error),
  });

  return { open, merge };
}
