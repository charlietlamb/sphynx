import { cn } from "@sphynx/ui/lib/utils";

interface EnvTagProps {
  className?: string;
  value: string;
}

const ACCENT_ENVIRONMENTS = new Set(["production", "prod", "live"]);

export function EnvTag({ value, className }: EnvTagProps) {
  const accent = ACCENT_ENVIRONMENTS.has(value.toLowerCase());

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-wide",
        accent
          ? "border-primary/30 text-primary"
          : "border-border text-muted-foreground",
        className
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          accent ? "bg-primary" : "bg-muted-foreground/50"
        )}
      />
      {value}
    </span>
  );
}
