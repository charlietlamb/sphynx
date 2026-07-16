import { Kbd } from "@sphynx/ui/components/ui/kbd";

const BINDINGS: [string, string][] = [
  ["j / k", "Next / previous line (crosses files)"],
  ["h / l", "Move cursor (pane hop at edge)"],
  ["w / b / e", "Next / previous / end of word"],
  ["Enter", "Open the symbol under the cursor"],
  ["J / K", "Next / previous file"],
  ["H / L", "Focus left / right column"],
  ["f", "Hint mode — open a definition"],
  ["u", "Pop the last definition"],
  ["Esc", "Close all definitions"],
  ["z", "Jump to the call site"],
  ["v", "Mark file viewed and advance"],
  ["?", "Toggle this help"],
];

export function ReviewHelp() {
  return (
    <div className="fixed right-6 bottom-6 z-50 w-72 rounded-lg border border-border bg-background p-4 shadow-lg">
      <p className="mb-3 font-medium text-sm">Keyboard shortcuts</p>
      <dl className="flex flex-col gap-1.5">
        {BINDINGS.map(([keys, description]) => (
          <div className="flex items-center justify-between gap-3" key={keys}>
            <dt>
              <Kbd>{keys}</Kbd>
            </dt>
            <dd className="text-muted-foreground text-xs">{description}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
