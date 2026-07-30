import {
  GitPullRequestIcon,
  MagnifyingGlassIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import type { QueuePull } from "@sphynx/schema/review-queue";
import { EmptyState } from "@sphynx/ui/components/empty-state";
import { Button } from "@sphynx/ui/components/ui/button";
import type { RefObject } from "react";
import { BranchGroup } from "@/components/dashboard/branch-group";
import { QueueRow } from "@/components/dashboard/queue-row";
import { QueueRowSkeleton } from "@/components/dashboard/queue-row-skeleton";
import { QueueSearch } from "@/components/dashboard/queue-search";
import { SearchScopes } from "@/components/dashboard/search-scopes";
import { PaneHeaderLabel } from "@/components/layout/section-header";
import { type BranchQueue, pullKey, type QueueFilter } from "@/lib/attention";

const EMPTY_CLASS = "min-h-[16rem] flex-1";

const SEARCH_SKELETON_WIDTHS = [
  "52%",
  "38%",
  "61%",
  "44%",
  "56%",
  "33%",
  "48%",
];

interface SearchState {
  active: boolean;
  isError: boolean;
  isPending: boolean;
  pulls: readonly QueuePull[];
  totalCount: number;
}

interface QueuePaneProps {
  allRepos: boolean;
  filter: QueueFilter;
  focusedKey: string | null;
  now: number;
  onFilter: (filter: QueueFilter) => void;
  onFocus: (key: string) => void;
  onOpen: (pull: QueuePull) => void;
  onSearch: (query: string) => void;
  onToggleRepos: () => void;
  queue: BranchQueue;
  search: SearchState;
  searchInput: RefObject<HTMLInputElement | null>;
  searchQuery: string;
}

export function QueuePane({
  allRepos,
  filter,
  focusedKey,
  now,
  onFilter,
  onFocus,
  onOpen,
  onSearch,
  onToggleRepos,
  queue,
  search,
  searchInput,
  searchQuery,
}: QueuePaneProps) {
  const total = queue.groups.reduce((sum, group) => sum + group.total, 0);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-3 rounded-t-[calc(var(--radius)-1px)] border-border border-b bg-card px-4">
        <PaneHeaderLabel
          count={search.active ? search.totalCount : total}
          icon={<GitPullRequestIcon weight="fill" />}
          label="Pull requests"
        />
        <QueueSearch
          inputRef={searchInput}
          onChange={onSearch}
          query={searchQuery}
        />
      </div>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-2">
        {search.active ? (
          <>
            <SearchScopes
              allRepos={allRepos}
              onChange={onSearch}
              onToggleRepos={onToggleRepos}
              query={searchQuery}
              showing={search.pulls.length}
              total={search.totalCount}
            />
            <SearchResults
              focusedKey={focusedKey}
              now={now}
              onFocus={onFocus}
              onOpen={onOpen}
              search={search}
            />
          </>
        ) : (
          <OpenQueue
            filter={filter}
            focusedKey={focusedKey}
            now={now}
            onFilter={onFilter}
            onFocus={onFocus}
            onOpen={onOpen}
            queue={queue}
          />
        )}
      </div>
    </div>
  );
}

function SearchResults({
  focusedKey,
  now,
  onFocus,
  onOpen,
  search,
}: {
  focusedKey: string | null;
  now: number;
  onFocus: (key: string) => void;
  onOpen: (pull: QueuePull) => void;
  search: SearchState;
}) {
  if (search.isError) {
    return (
      <EmptyState
        bordered={false}
        className={EMPTY_CLASS}
        description="Couldn't reach GitHub search. Try again in a moment."
        icon={<WarningCircleIcon weight="fill" />}
        title="Search unavailable"
      />
    );
  }
  if (search.isPending && search.pulls.length === 0) {
    return (
      <div className="flex flex-col">
        {SEARCH_SKELETON_WIDTHS.map((width) => (
          <QueueRowSkeleton key={width} titleWidth={width} />
        ))}
      </div>
    );
  }
  if (search.pulls.length === 0) {
    return (
      <EmptyState
        bordered={false}
        className={EMPTY_CLASS}
        description="No pull requests match that query."
        icon={<MagnifyingGlassIcon weight="bold" />}
        title="No matches"
      />
    );
  }
  return (
    <div className="flex flex-col">
      {search.pulls.map((pull) => {
        const key = pullKey(pull);
        return (
          <QueueRow
            focused={key === focusedKey}
            key={key}
            now={now}
            onFocus={() => onFocus(key)}
            onOpen={() => onOpen(pull)}
            pull={pull}
          />
        );
      })}
    </div>
  );
}

function OpenQueue({
  filter,
  focusedKey,
  now,
  onFilter,
  onFocus,
  onOpen,
  queue,
}: {
  filter: QueueFilter;
  focusedKey: string | null;
  now: number;
  onFilter: (filter: QueueFilter) => void;
  onFocus: (key: string) => void;
  onOpen: (pull: QueuePull) => void;
  queue: BranchQueue;
}) {
  if (queue.groups.length === 0) {
    if (filter === "all") {
      return (
        <EmptyState
          bordered={false}
          className={EMPTY_CLASS}
          description="This repository has no open pull requests to review."
          icon={<GitPullRequestIcon weight="fill" />}
          title="No open pull requests"
        />
      );
    }
    return (
      <EmptyState
        action={
          <Button onClick={() => onFilter("all")} size="sm" variant="outline">
            Show all
          </Button>
        }
        bordered={false}
        className={EMPTY_CLASS}
        description="No pull requests match this filter."
        icon={<GitPullRequestIcon weight="fill" />}
        title="Nothing here"
      />
    );
  }
  return (
    <div className="flex flex-col">
      {queue.groups.map((group) => (
        <BranchGroup
          focusedKey={focusedKey}
          group={group}
          key={group.branch}
          now={now}
          onFocus={onFocus}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
