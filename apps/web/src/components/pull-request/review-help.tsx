import { KeymapList } from "@/components/pull-request/keymap-list";
import { REVIEW_KEY_HELP } from "@/components/pull-request/review-keymap";

export function ReviewHelp() {
  return (
    <div className="fade-in slide-in-from-bottom-1 fixed right-6 bottom-6 z-50 max-h-[80vh] w-80 animate-in overflow-y-auto rounded-lg bg-popover p-4 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-150">
      <p className="mb-3 font-medium text-sm">Keyboard shortcuts</p>
      <KeymapList bindings={REVIEW_KEY_HELP} />
    </div>
  );
}
