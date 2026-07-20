import { GitPullRequestIcon } from "@phosphor-icons/react";
import type { QueuePull } from "@sphynx/schema/review-queue";
import type { RefObject } from "react";
import { BranchGroup } from "@/components/dashboard/branch-group";
import { QueueFilterMenu } from "@/components/dashboard/queue-filter-menu";
import { QueueRow } from "@/components/dashboard/queue-row";
import { QueueRowSkeleton } from "@/components/dashboard/queue-row-skeleton";
import { QueueSearch, SearchScopes } from "@/components/dashboard/queue-search";
import { SectionHeader } from "@/components/layout/section-header";
import { type BranchQueue, pullKey, type QueueFilter } from "@/lib/attention";

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
    <div className="flex flex-col px-4 pb-3">
      <SectionHeader
        action={
          <span className="text-[11px] text-muted-foreground/60 tabular-nums">
            {search.active ? search.totalCount : total}
          </span>
        }
        className="-mx-4 px-4"
        icon={<GitPullRequestIcon className="size-3" weight="fill" />}
        label="Pull requests"
      />
      <div className="-mx-4 flex items-center gap-2 border-border border-b px-4 py-2">
        <QueueSearch
          inputRef={searchInput}
          onChange={onSearch}
          query={searchQuery}
        />
        {search.active ? null : (
          <QueueFilterMenu onSelect={onFilter} selected={filter} />
        )}
      </div>
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
      <p className="px-[10px] py-7 text-muted-foreground text-sm">
        Couldn't reach GitHub search.
      </p>
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
      <p className="px-[10px] py-7 text-muted-foreground text-sm">
        No pulls match that query.
      </p>
    );
  }
  return (
    <div className="fade-in flex animate-in flex-col duration-150">
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
    return (
      <p className="px-[10px] py-7 text-muted-foreground text-sm">
        {filter === "all" ? (
          "No open pull requests."
        ) : (
          <>
            Nothing here.{" "}
            <button
              className="text-primary underline-offset-2 hover:underline"
              onClick={() => onFilter("all")}
              type="button"
            >
              Show all
            </button>
          </>
        )}
      </p>
    );
  }
  return (
    <div className="fade-in flex animate-in flex-col duration-150">
      {queue.groups.map((group, index) => (
        <BranchGroup
          first={index === 0}
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
