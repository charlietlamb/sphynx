import type { PullRequestRef } from "@sphynx/schema/pull-requests";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  type RepoOption,
  RepoSwitcher,
} from "@/components/dashboard/repo-switcher";
import { toRepoOption, usePipeline } from "@/components/dashboard/use-pipeline";
import { useSettings } from "@/components/settings/settings-provider";
import { useSession } from "@/lib/auth-client";

export function PullRequestSwitcher({
  pullRequestRef,
}: {
  pullRequestRef: PullRequestRef;
}) {
  const navigate = useNavigate();
  const { update } = useSettings();
  const { data: session, isPending: sessionPending } = useSession();
  const authed = Boolean(session?.user);
  const pipeline = usePipeline(null, authed && !sessionPending);
  const currentKey = `${pullRequestRef.owner}/${pullRequestRef.repo}`;

  const repos = useMemo(() => {
    const options: RepoOption[] = [];
    for (const flow of pipeline.data?.repos ?? []) {
      if (flow.openPulls.length > 0) {
        options.push(toRepoOption(flow));
      }
    }
    options.sort((a, b) => b.openCount - a.openCount);
    if (options.some((option) => option.key === currentKey)) {
      return options;
    }
    const fallback: RepoOption = {
      key: currentKey,
      owner: pullRequestRef.owner,
      repo: pullRequestRef.repo,
      openCount: 0,
      mergeable: 0,
      contested: 0,
    };
    return [fallback, ...options];
  }, [pipeline.data, currentKey, pullRequestRef.owner, pullRequestRef.repo]);

  const selected =
    repos.find((option) => option.key === currentKey) ?? repos[0] ?? null;

  const selectRepo = (key: string) => {
    update({ selectedRepo: `${key}` });
    if (key !== currentKey) {
      navigate({ to: "/" });
    }
  };

  return (
    <RepoSwitcher onSelect={selectRepo} repos={repos} selected={selected} />
  );
}
