import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Input } from "@sphynx/ui/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@sphynx/ui/components/ui/tabs";
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
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Tabs
        onValueChange={(value) => onFilter(value as WorkbenchFilter)}
        value={filter}
      >
        <TabsList>
          {WORKBENCH_FILTERS.map(({ value, label }) => (
            <TabsTrigger className="px-3 text-xs" key={value} value={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="relative w-52">
        <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          className="h-6 pl-6 text-[11px]"
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search actor, title, #number"
          value={search}
        />
      </div>
    </div>
  );
}
