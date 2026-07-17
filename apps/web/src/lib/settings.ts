import { useCallback, useSyncExternalStore } from "react";

export interface ReviewSettings {
  codeTheme: string;
  mirrorCodeTheme: boolean;
  sidebarCollapsed: boolean;
}

const DEFAULT_SETTINGS: ReviewSettings = {
  codeTheme: "pierre",
  mirrorCodeTheme: false,
  sidebarCollapsed: false,
};

export const CODE_THEMES: Record<
  string,
  { label: string; themes?: { dark: string; light: string } }
> = {
  pierre: { label: "Pierre" },
  ayu: { label: "Ayu", themes: { dark: "ayu-dark", light: "ayu-light" } },
  catppuccin: {
    label: "Catppuccin",
    themes: { dark: "catppuccin-mocha", light: "catppuccin-latte" },
  },
  dracula: {
    label: "Dracula",
    themes: { dark: "dracula", light: "dracula-soft" },
  },
  everforest: {
    label: "Everforest",
    themes: { dark: "everforest-dark", light: "everforest-light" },
  },
  github: {
    label: "GitHub",
    themes: { dark: "github-dark-default", light: "github-light-default" },
  },
  gruvbox: {
    label: "Gruvbox",
    themes: { dark: "gruvbox-dark-medium", light: "gruvbox-light-medium" },
  },
  kanagawa: {
    label: "Kanagawa",
    themes: { dark: "kanagawa-wave", light: "kanagawa-lotus" },
  },
  material: {
    label: "Material",
    themes: { dark: "material-theme-ocean", light: "material-theme-lighter" },
  },
  monokai: { label: "Monokai", themes: { dark: "monokai", light: "monokai" } },
  "night-owl": {
    label: "Night Owl",
    themes: { dark: "night-owl", light: "night-owl-light" },
  },
  nord: { label: "Nord", themes: { dark: "nord", light: "nord" } },
  "one-dark-pro": {
    label: "One Dark Pro",
    themes: { dark: "one-dark-pro", light: "one-light" },
  },
  "rose-pine": {
    label: "Rosé Pine",
    themes: { dark: "rose-pine-moon", light: "rose-pine-dawn" },
  },
  solarized: {
    label: "Solarized",
    themes: { dark: "solarized-dark", light: "solarized-light" },
  },
  "tokyo-night": {
    label: "Tokyo Night",
    themes: { dark: "tokyo-night", light: "tokyo-night" },
  },
  vscode: {
    label: "VS Code",
    themes: { dark: "dark-plus", light: "light-plus" },
  },
  vitesse: {
    label: "Vitesse",
    themes: { dark: "vitesse-dark", light: "vitesse-light" },
  },
};

const STORAGE_KEY = "sphynx.settings";
const listeners = new Set<() => void>();
let cached: ReviewSettings | null = null;

function readSettings(): ReviewSettings {
  if (cached) {
    return cached;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cached = raw
      ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
      : DEFAULT_SETTINGS;
  } catch {
    cached = DEFAULT_SETTINGS;
  }
  return cached ?? DEFAULT_SETTINGS;
}

function writeSettings(partial: Partial<ReviewSettings>) {
  cached = { ...readSettings(), ...partial };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // Persisting is best-effort; the in-memory value still applies.
  }
  for (const listener of listeners) {
    listener();
  }
}

export function toggleSidebarCollapsed() {
  writeSettings({ sidebarCollapsed: !readSettings().sidebarCollapsed });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings() {
  const settings = useSyncExternalStore(
    subscribe,
    readSettings,
    () => DEFAULT_SETTINGS
  );
  const update = useCallback(
    (partial: Partial<ReviewSettings>) => writeSettings(partial),
    []
  );
  return { settings, update };
}
