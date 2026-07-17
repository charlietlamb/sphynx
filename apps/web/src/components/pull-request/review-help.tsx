import { KeymapList } from "@/components/pull-request/keymap-list";

export function ReviewHelp() {
  return (
    <div className="fade-in slide-in-from-bottom-1 fixed right-6 bottom-6 z-50 max-h-[80vh] w-80 animate-in overflow-y-auto rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-md duration-150">
      <p className="mb-3 font-medium text-sm">Keyboard shortcuts</p>
      <KeymapList />
    </div>
  );
}
