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
          className="whitespace-pre-wrap break-words bg-deletion/10 px-2.5 py-0.5 text-foreground/80"
          key={`original-${index}-${line}`}
        >
          <span className="mr-2 select-none text-deletion">-</span>
          {line}
        </div>
      ))}
      {suggestedLines.map((line, index) => (
        <div
          className="whitespace-pre-wrap break-words bg-addition/10 px-2.5 py-0.5 text-foreground/90"
          key={`suggested-${index}-${line}`}
        >
          <span className="mr-2 select-none text-addition">+</span>
          {line}
        </div>
      ))}
    </div>
  );
}
