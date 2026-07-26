import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { Kbd } from "@sphynx/ui/components/ui/kbd";
import type { RefObject } from "react";

interface QueueSearchProps {
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (query: string) => void;
  query: string;
}

export function QueueSearch({ inputRef, onChange, query }: QueueSearchProps) {
  const active = query.trim().length > 0;
  return (
    <div className="input-bevel-shadow group flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-2.5 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 dark:bg-input/30">
      <MagnifyingGlassIcon className="size-3.5 shrink-0 text-muted-foreground transition-colors group-focus-within:text-foreground" />
      <input
        className="h-full min-w-0 flex-1 bg-transparent text-xs leading-none outline-none placeholder:text-muted-foreground/40"
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
