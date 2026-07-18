import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sphynx/ui/components/ui/select";
import { Switch } from "@sphynx/ui/components/ui/switch";
import { SettingRow } from "@/components/settings/setting-row";
import { useSettings } from "@/components/settings/settings-provider";
import { ThemePicker } from "@/components/settings/theme-picker";
import { CODE_THEMES } from "@/lib/settings";

export function SettingsAppearance() {
  const { settings, update } = useSettings();
  return (
    <div className="flex flex-col divide-y divide-border">
      <SettingRow description="Match your system or pick a side." title="Theme">
        <ThemePicker />
      </SettingRow>
      <SettingRow
        description="Syntax colors for diffs and definitions."
        title="Code theme"
      >
        <Select
          onValueChange={(value) =>
            typeof value === "string" && update({ codeTheme: value })
          }
          value={settings.codeTheme}
        >
          <SelectTrigger className="w-36 text-xs" size="sm">
            <SelectValue>
              {CODE_THEMES[settings.codeTheme]?.label ?? settings.codeTheme}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CODE_THEMES).map(([id, entry]) => (
              <SelectItem key={id} value={id}>
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
      <SettingRow
        description="Tint the whole interface with the code theme."
        title="Mirror in app"
      >
        <Switch
          checked={settings.mirrorCodeTheme}
          disabled={!CODE_THEMES[settings.codeTheme]?.themes}
          onCheckedChange={(checked) => update({ mirrorCodeTheme: checked })}
        />
      </SettingRow>
    </div>
  );
}
