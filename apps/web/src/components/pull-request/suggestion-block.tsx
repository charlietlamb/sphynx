interface SuggestionBlockProps {
  originalLines: readonly string[];
  suggestedLines: readonly string[];
}

export function SuggestionBlock({
  originalLines,
  suggestedLines,
}: SuggestionBlockProps) {
  return (
    <div className="overflow-hidden rounded-md border border-border font-mono text-xs">
      <div className="border-border border-b bg-muted/50 px-2.5 py-1 font-sans text-muted-foreground">
        Suggested change
      </div>
      {originalLines.map((line, index) => (
        <div
          className="whitespace-pre-wrap break-words bg-destructive/10 px-2.5 py-0.5 text-foreground/80"
          key={`original-${index}-${line}`}
        >
          <span className="mr-2 select-none text-destructive">-</span>
          {line}
        </div>
      ))}
      {suggestedLines.map((line, index) => (
        <div
          className="whitespace-pre-wrap break-words bg-emerald-500/10 px-2.5 py-0.5 text-foreground/90"
          key={`suggested-${index}-${line}`}
        >
          <span className="mr-2 select-none text-emerald-600 dark:text-emerald-400">
            +
          </span>
          {line}
        </div>
      ))}
    </div>
  );
}
