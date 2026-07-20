export interface ReviewSettings {
  codeTheme: string;
  mirrorCodeTheme: boolean;
  selectedInstallation: number | null;
  selectedRepo: string | null;
  sidebarCollapsed: boolean;
}

export const DEFAULT_SETTINGS: ReviewSettings = {
  codeTheme: "pierre",
  mirrorCodeTheme: false,
  selectedInstallation: null,
  selectedRepo: null,
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

export const SETTINGS_COOKIE = "sphynx-settings";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const LEGACY_STORAGE_KEY = "sphynx.settings";

export function decodeSettings(raw: string): Partial<ReviewSettings> {
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(decodeURIComponent(raw));
  }
}

export function parseSettings(raw: string | null | undefined): ReviewSettings {
  if (!raw) {
    return DEFAULT_SETTINGS;
  }
  try {
    return { ...DEFAULT_SETTINGS, ...decodeSettings(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function readCookieValue(): string | null {
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${SETTINGS_COOKIE}=`));
  return match ? match.slice(SETTINGS_COOKIE.length + 1) : null;
}

export function clientSettings(): ReviewSettings {
  return parseSettings(readCookieValue());
}

export function hasSettingsCookie(): boolean {
  return readCookieValue() !== null;
}
