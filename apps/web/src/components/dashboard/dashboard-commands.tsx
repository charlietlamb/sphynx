import type { QueuePull } from "@sphynx/schema/review-queue";
import { type RefObject, useMemo } from "react";
import { useRegisterCommands } from "@/components/command-palette/command-palette-context";
import { buildDashboardGroup } from "@/components/command-palette/palette-commands";
import { useDialog } from "@/components/dashboard/dashboard-dialogs";
import type { RepoOption } from "@/components/dashboard/repo-switcher";

interface DashboardCommandsProps {
  authed: boolean;
  focusedPull: QueuePull | null;
  onOpenPull: (pull: QueuePull) => void;
  onSelectRepo: (key: string) => void;
  onToggleWorkbench: () => void;
  repos: readonly RepoOption[];
  searchInput: RefObject<HTMLInputElement | null>;
  selectedRepo: RepoOption | null;
}

export function DashboardCommands({
  authed,
  focusedPull,
  onOpenPull,
  onSelectRepo,
  onToggleWorkbench,
  repos,
  searchInput,
  selectedRepo,
}: DashboardCommandsProps) {
  const dialogs = useDialog();

  const contribution = useMemo(() => {
    const cycleRepo = (delta: number) => {
      if (repos.length === 0) {
        return;
      }
      const index = repos.findIndex(
        (option) => option.key === selectedRepo?.key
      );
      const next = repos[(index + delta + repos.length) % repos.length];
      if (next) {
        onSelectRepo(next.key);
      }
    };
    return {
      groups: [
        buildDashboardGroup({
          authed,
          focusedPull,
          onBlock: () => {
            if (focusedPull) {
              dialogs.open("blockPull", { pull: focusedPull });
            }
          },
          onFocusSearch: () => searchInput.current?.focus(),
          onMerge: () => {
            if (focusedPull) {
              dialogs.open("mergePull", { pull: focusedPull });
            }
          },
          onNextRepo: () => cycleRepo(1),
          onOpenPull: () => {
            if (focusedPull) {
              onOpenPull(focusedPull);
            }
          },
          onPrevRepo: () => cycleRepo(-1),
          onToggleWorkbench,
        }),
      ],
    };
  }, [
    authed,
    focusedPull,
    dialogs,
    searchInput,
    repos,
    selectedRepo,
    onSelectRepo,
    onOpenPull,
    onToggleWorkbench,
  ]);

  useRegisterCommands(contribution);
  return null;
}
