import { cn } from "@sphynx/ui/lib/utils";

const SEARCH_SCOPES = [
  { label: "Open", value: "is:open" },
  { label: "Merged", value: "is:merged" },
  { label: "Closed", value: "is:closed" },
  { label: "Mine", value: "author:@me" },
  { label: "Review requested", value: "review-requested:@me" },
] as const;

const WHITESPACE = /\s+/;

function toggleQualifier(query: string, qualifier: string) {
  const parts = query.split(WHITESPACE).filter(Boolean);
  const next = parts.includes(qualifier)
    ? parts.filter((part) => part !== qualifier)
    : [...parts, qualifier];
  return next.join(" ");
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
