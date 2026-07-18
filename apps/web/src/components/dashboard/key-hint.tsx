interface KeyHintProps {
  action: string;
  keys: string;
}

export function KeyHint({ action, keys }: KeyHintProps) {
  return (
    <span className="flex items-baseline gap-1.5 text-[11px] text-muted-foreground/60">
      <kbd className="rounded-sm border border-border bg-muted/40 px-1 py-px font-mono text-[10px] text-muted-foreground uppercase">
        {keys}
      </kbd>
      {action}
    </span>
  );
}
