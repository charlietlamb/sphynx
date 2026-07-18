import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { saveServerSettings } from "@/lib/server/settings-cookie";
import {
  decodeSettings,
  hasSettingsCookie,
  LEGACY_STORAGE_KEY,
  type ReviewSettings,
} from "@/lib/settings";

type SettingsUpdate =
  | Partial<ReviewSettings>
  | ((previous: ReviewSettings) => Partial<ReviewSettings>);

interface SettingsContextValue {
  settings: ReviewSettings;
  update: (input: SettingsUpdate) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function readLegacySettings(): Partial<ReviewSettings> | null {
  try {
    if (hasSettingsCookie()) {
      return null;
    }
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    return decodeSettings(raw);
  } catch {
    return null;
  }
}

export function SettingsProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial: ReviewSettings;
}) {
  const [settings, setSettings] = useState(initial);
  const liveSettings = useRef(initial);

  const update = useCallback((input: SettingsUpdate) => {
    const previous = liveSettings.current;
    const next = {
      ...previous,
      ...(typeof input === "function" ? input(previous) : input),
    };
    liveSettings.current = next;
    setSettings(next);
    saveServerSettings({ data: next }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const legacy = readLegacySettings();
    if (legacy) {
      update(legacy);
    }
  }, [update]);

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used inside SettingsProvider");
  }
  return context;
}
