import type { SymbolHintState } from "@/components/pull-request/symbol-hints";

export function SymbolHintOverlay({ buffer, items }: SymbolHintState) {
  const visible: SymbolHintState["items"] = [];
  for (const hint of items) {
    if (hint.label.startsWith(buffer)) {
      visible.push(hint);
    }
  }
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {visible.map((hint) => (
        <span
          className="absolute rounded bg-primary px-1 font-mono text-primary-foreground text-xs shadow-sm"
          key={hint.label}
          style={{ left: hint.x, top: hint.y - 18 }}
        >
          {hint.label}
        </span>
      ))}
    </div>
  );
}
