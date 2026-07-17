import { KeymapList } from "@/components/pull-request/keymap-list";

export function SettingsKeyboard() {
  return (
    <div className="flex flex-col gap-3">
      <KeymapList />
      <p className="text-muted-foreground text-xs">
        Custom keybindings coming soon.
      </p>
    </div>
  );
}
