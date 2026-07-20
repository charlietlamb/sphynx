import { CaretDownIcon } from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@sphynx/ui/components/ui/dropdown-menu";
import { cn } from "@sphynx/ui/lib/utils";
import { QUEUE_FILTERS, type QueueFilter } from "@/lib/attention";

interface QueueFilterMenuProps {
  onSelect: (filter: QueueFilter) => void;
  selected: QueueFilter;
}

export function QueueFilterMenu({ onSelect, selected }: QueueFilterMenuProps) {
  const active = QUEUE_FILTERS.find((option) => option.value === selected);
  const filtered = selected !== "all";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "input-bevel-shadow group flex h-7 w-28 shrink-0 items-center justify-between gap-1.5 rounded-md border border-border bg-background px-2.5 text-[11px] outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 data-[state=open]:bg-muted dark:bg-input/30 dark:hover:bg-input/50",
          filtered ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span className="truncate">{filtered ? active?.label : "Filter"}</span>
        <CaretDownIcon className="size-2.5 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-(--anchor-width) min-w-(--anchor-width)"
      >
        <DropdownMenuRadioGroup
          onValueChange={(value) => onSelect(value as QueueFilter)}
          value={selected}
        >
          {QUEUE_FILTERS.map((option) => (
            <DropdownMenuRadioItem
              className="text-[13px]"
              key={option.value}
              value={option.value}
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
