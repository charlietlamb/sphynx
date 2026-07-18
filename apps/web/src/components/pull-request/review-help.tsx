import { KeymapList } from "@/components/pull-request/keymap-list";
import {
  DEFAULT_KEYMAP,
  keymapHelp,
} from "@/components/pull-request/review-keymap";

const BINDINGS = [
  ...keymapHelp(DEFAULT_KEYMAP),
  { chord: "1-9", description: "Count — repeats the next motion" },
  { chord: "Esc", description: "Cancel — draft, selection, definitions" },
];

export function ReviewHelp() {
  return (
    <div className="fade-in slide-in-from-bottom-1 fixed right-6 bottom-6 z-50 max-h-[80vh] w-80 animate-in overflow-y-auto rounded-lg bg-popover p-4 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-150">
      <p className="mb-3 font-medium text-sm">Keyboard shortcuts</p>
      <KeymapList bindings={BINDINGS} />
    </div>
  );
}
