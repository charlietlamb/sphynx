import { cn } from "@sphynx/ui/lib/utils";

interface FilterPillsProps<T extends string> {
  onSelect: (value: T) => void;
  options: readonly { label: string; value: T }[];
  selected: T;
}

export function FilterPills<T extends string>({
  onSelect,
  options,
  selected,
}: FilterPillsProps<T>) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      {options.map(({ value, label }) => (
        <button
          className={cn(
            "text-[11px] transition-colors",
            selected === value
              ? "text-foreground"
              : "text-muted-foreground/70 hover:text-foreground"
          )}
          key={value}
          onClick={() => onSelect(value)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
