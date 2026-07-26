import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { Kbd } from "@sphynx/ui/components/ui/kbd";
import type { ReactNode, RefObject } from "react";

interface QueueSearchProps {
  filter?: ReactNode;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (query: string) => void;
  query: string;
}

export function QueueSearch({
  filter,
  inputRef,
  onChange,
  query,
}: QueueSearchProps) {
  const active = query.trim().length > 0;
  return (
    <div className="group flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md border border-transparent pr-1 pl-2.5 transition-colors focus-within:border-border focus-within:bg-background focus-within:ring-2 focus-within:ring-ring/20 hover:bg-alpha-2 dark:focus-within:bg-input/30">
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
          className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-alpha-4 hover:text-foreground"
          onClick={() => onChange("")}
          type="button"
        >
          <XIcon className="size-3" />
        </button>
      ) : (
        <Kbd className="mr-0.5 shrink-0">/</Kbd>
      )}
      {filter ? (
        <>
          <span aria-hidden className="h-4 w-px shrink-0 bg-border" />
          {filter}
        </>
      ) : null}
    </div>
  );
}
