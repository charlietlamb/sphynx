import { DASHBOARD_KEY_HELP } from "@/components/dashboard/dashboard-key-help";
import { KeymapList } from "@/components/pull-request/keymap-list";
import { REVIEW_KEY_HELP } from "@/components/pull-request/review-keymap";

export function SettingsKeyboard() {
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-[11px] text-muted-foreground/60">
          dashboard
        </h3>
        <KeymapList bindings={DASHBOARD_KEY_HELP} />
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-[11px] text-muted-foreground/60">
          review workspace
        </h3>
        <KeymapList bindings={REVIEW_KEY_HELP} />
      </section>
      <p className="text-muted-foreground text-xs">
        Custom keybindings coming soon.
      </p>
    </div>
  );
}
