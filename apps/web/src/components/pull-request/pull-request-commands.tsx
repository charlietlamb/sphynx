import type {
  PullRequestFile,
  PullRequestSummary,
} from "@sphynx/schema/pull-requests";
import { useMemo } from "react";
import { useRegisterCommands } from "@/components/command-palette/command-palette-context";
import { buildPullRequestContribution } from "@/components/command-palette/palette-commands";
import type { PullRequestSearchSetter } from "@/components/pull-request/pull-request-search";

interface PullRequestCommandsProps {
  files: readonly PullRequestFile[] | undefined;
  pullRequest: PullRequestSummary | undefined;
  setAllViewed: (paths: readonly string[]) => void;
  setSearch: PullRequestSearchSetter;
}

export function PullRequestCommands({
  files,
  pullRequest,
  setAllViewed,
  setSearch,
}: PullRequestCommandsProps) {
  const contribution = useMemo(() => {
    if (!(pullRequest && files)) {
      return {};
    }
    const branch = pullRequest.head.ref;
    const githubUrl = pullRequest.githubUrl;
    return buildPullRequestContribution({
      branch,
      filePaths: files.map((file) => file.path),
      githubUrl,
      onCopyBranch: () => {
        navigator.clipboard.writeText(branch);
      },
      onJumpToFile: (path) => setSearch({ file: path, tab: "diff" }),
      onMarkAllViewed: () => setAllViewed(files.map((file) => file.path)),
      onOpenGithub: () => {
        window.open(githubUrl, "_blank", "noreferrer");
      },
      onSwitchTab: (tab) => setSearch({ tab }),
    });
  }, [files, pullRequest, setAllViewed, setSearch]);

  useRegisterCommands(contribution);
  return null;
}
