import { CopyButton } from "@sphynx/ui/components/copy-button";
import { cn } from "@sphynx/ui/lib/utils";

interface MonoValueProps {
  className?: string;
  copyable?: boolean;
  value: string;
}

export function MonoValue({ value, className, copyable }: MonoValueProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-muted-foreground text-xs tabular-nums tracking-tight",
        className
      )}
    >
      <span className="truncate">{value}</span>
      {copyable ? (
        <CopyButton
          className="size-5 [&_svg]:size-3"
          label="Copy"
          value={value}
        />
      ) : null}
    </span>
  );
}
