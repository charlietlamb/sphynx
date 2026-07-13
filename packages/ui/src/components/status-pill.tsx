import { cn } from "@sphynx/ui/lib/utils";

export type StatusTone = "neutral" | "positive" | "warning" | "danger";

const TONES: Record<StatusTone, { dot: string; text: string; border: string }> =
  {
    neutral: {
      dot: "bg-muted-foreground/50",
      text: "text-muted-foreground",
      border: "border-border",
    },
    positive: {
      dot: "bg-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-500/30",
    },
    warning: {
      dot: "bg-amber-500",
      text: "text-amber-600 dark:text-amber-400",
      border: "border-amber-500/30",
    },
    danger: {
      dot: "bg-destructive",
      text: "text-destructive",
      border: "border-destructive/30",
    },
  };

interface StatusPillProps {
  className?: string;
  label: string;
  tone?: StatusTone;
}

export function StatusPill({
  label,
  tone = "neutral",
  className,
}: StatusPillProps) {
  const styles = TONES[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-medium text-xs capitalize",
        styles.border,
        styles.text,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", styles.dot)} />
      {label}
    </span>
  );
}
