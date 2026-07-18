import {
  type KeyBinding,
  KeymapList,
} from "@/components/pull-request/keymap-list";
import {
  DEFAULT_KEYMAP,
  keymapHelp,
} from "@/components/pull-request/review-keymap";

const DASHBOARD_BINDINGS: readonly KeyBinding[] = [
  { chord: "j / k", description: "Move through the queue" },
  { chord: "↵", description: "Open the focused pull" },
  { chord: "1-9", description: "Filter to a branch (again to clear)" },
  { chord: "[ ]", description: "Switch repo" },
];

const REVIEW_BINDINGS: readonly KeyBinding[] = [
  ...keymapHelp(DEFAULT_KEYMAP),
  { chord: "1-9", description: "Count — repeats the next motion" },
  { chord: "Esc", description: "Cancel — draft, selection, definitions" },
];

export function SettingsKeyboard() {
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-[11px] text-muted-foreground/60">
          dashboard
        </h3>
        <KeymapList bindings={DASHBOARD_BINDINGS} />
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-[11px] text-muted-foreground/60">
          review workspace
        </h3>
        <KeymapList bindings={REVIEW_BINDINGS} />
      </section>
      <p className="text-muted-foreground text-xs">
        Custom keybindings coming soon.
      </p>
    </div>
  );
}
