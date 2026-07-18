import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { cn } from "@sphynx/ui/lib/utils";
import {
  WORKBENCH_FILTERS,
  type WorkbenchFilter,
} from "@/components/workbench/workbench-copy";

interface WorkbenchFiltersProps {
  filter: WorkbenchFilter;
  onFilter: (filter: WorkbenchFilter) => void;
  onSearch: (search: string) => void;
  search: string;
}

export function WorkbenchFilters({
  filter,
  onFilter,
  onSearch,
  search,
}: WorkbenchFiltersProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-4">
      <div className="flex shrink-0 items-center gap-3">
        {WORKBENCH_FILTERS.map(({ value, label }) => (
          <button
            className={cn(
              "text-xs transition-colors",
              filter === value
                ? "text-foreground"
                : "text-muted-foreground/70 hover:text-foreground"
            )}
            key={value}
            onClick={() => onFilter(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <span aria-hidden className="h-5 w-px shrink-0 bg-border" />
      <div className="relative min-w-0 max-w-64 flex-1">
        <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-0 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
        <input
          className="h-7 w-full bg-transparent pl-6 text-xs outline-none placeholder:text-muted-foreground/50"
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search actor, title, #number"
          value={search}
        />
      </div>
    </div>
  );
}
