import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { Kbd } from "@sphynx/ui/components/ui/kbd";
import { cn } from "@sphynx/ui/lib/utils";
import type { RefObject } from "react";

const SEARCH_SCOPES = [
  { label: "Open", value: "is:open" },
  { label: "Merged", value: "is:merged" },
  { label: "Closed", value: "is:closed" },
  { label: "Mine", value: "author:@me" },
  { label: "Review requested", value: "review-requested:@me" },
] as const;

interface QueueSearchProps {
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (query: string) => void;
  query: string;
}

const WHITESPACE = /\s+/;

function toggleQualifier(query: string, qualifier: string) {
  const parts = query.split(WHITESPACE).filter(Boolean);
  const next = parts.includes(qualifier)
    ? parts.filter((part) => part !== qualifier)
    : [...parts, qualifier];
  return next.join(" ");
}

export function QueueSearch({ inputRef, onChange, query }: QueueSearchProps) {
  const active = query.trim().length > 0;
  return (
    <div className="input-bevel-shadow group flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-2.5 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 dark:bg-input/30">
      <MagnifyingGlassIcon className="size-3.5 shrink-0 text-muted-foreground transition-colors group-focus-within:text-foreground" />
      <input
        className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/40"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search pulls…"
        ref={inputRef}
        value={query}
      />
      {active ? (
        <button
          aria-label="Clear search"
          className="-mr-0.5 flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-alpha-4 hover:text-foreground"
          onClick={() => onChange("")}
          type="button"
        >
          <XIcon className="size-3" />
        </button>
      ) : (
        <Kbd className="shrink-0">/</Kbd>
      )}
    </div>
  );
}

interface SearchScopesProps {
  allRepos: boolean;
  onChange: (query: string) => void;
  onToggleRepos: () => void;
  query: string;
  showing: number;
  total: number;
}

export function SearchScopes({
  allRepos,
  onChange,
  onToggleRepos,
  query,
  showing,
  total,
}: SearchScopesProps) {
  return (
    <div className="fade-in -mx-4 flex animate-in items-center gap-3 border-border border-b px-[26px] py-2 duration-150">
      {SEARCH_SCOPES.map((scope) => (
        <button
          className={cn(
            "text-[11px] transition-colors",
            query.includes(scope.value)
              ? "text-foreground"
              : "text-muted-foreground/70 hover:text-foreground"
          )}
          key={scope.value}
          onClick={() => onChange(toggleQualifier(query, scope.value))}
          type="button"
        >
          {scope.label}
        </button>
      ))}
      <span aria-hidden className="h-3 w-px bg-border" />
      <button
        className="text-[11px] text-muted-foreground/70 transition-colors hover:text-foreground"
        onClick={onToggleRepos}
        type="button"
      >
        {allRepos ? "All repos" : "This repo"}
      </button>
      {total > 0 ? (
        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground/60 tabular-nums">
          {showing} of {total}
        </span>
      ) : null}
    </div>
  );
}
