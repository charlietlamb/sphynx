import { Switch } from "@sphynx/ui/components/ui/switch";
import { SettingRow } from "@/components/settings/setting-row";
import { useSettings } from "@/components/settings/settings-provider";

export function SettingsActions() {
  const { settings, update } = useSettings();

  return (
    <div className="flex flex-col">
      <SettingRow
        description="Confirm merges, blocks and releases with a toast."
        title="Confirm writes"
      >
        <Switch
          checked={settings.confirmActions}
          onCheckedChange={(checked) => update({ confirmActions: checked })}
        />
      </SettingRow>
    </div>
  );
}
