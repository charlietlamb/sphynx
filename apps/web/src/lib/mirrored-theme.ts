import { queryOptions } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";

interface ShikiThemeModule {
  default: {
    colors?: Record<string, string>;
  };
}

type ThemeLoader = () => Promise<ShikiThemeModule>;

const THEME_LOADERS: Record<string, ThemeLoader> = {
  "ayu-dark": () => import("@shikijs/themes/ayu-dark"),
  "ayu-light": () => import("@shikijs/themes/ayu-light"),
  "catppuccin-latte": () => import("@shikijs/themes/catppuccin-latte"),
  "catppuccin-mocha": () => import("@shikijs/themes/catppuccin-mocha"),
  "dark-plus": () => import("@shikijs/themes/dark-plus"),
  dracula: () => import("@shikijs/themes/dracula"),
  "dracula-soft": () => import("@shikijs/themes/dracula-soft"),
  "everforest-dark": () => import("@shikijs/themes/everforest-dark"),
  "everforest-light": () => import("@shikijs/themes/everforest-light"),
  "github-dark-default": () => import("@shikijs/themes/github-dark-default"),
  "github-light-default": () => import("@shikijs/themes/github-light-default"),
  "gruvbox-dark-medium": () => import("@shikijs/themes/gruvbox-dark-medium"),
  "gruvbox-light-medium": () => import("@shikijs/themes/gruvbox-light-medium"),
  "kanagawa-lotus": () => import("@shikijs/themes/kanagawa-lotus"),
  "kanagawa-wave": () => import("@shikijs/themes/kanagawa-wave"),
  "light-plus": () => import("@shikijs/themes/light-plus"),
  "material-theme-lighter": () =>
    import("@shikijs/themes/material-theme-lighter"),
  "material-theme-ocean": () => import("@shikijs/themes/material-theme-ocean"),
  monokai: () => import("@shikijs/themes/monokai"),
  "night-owl": () => import("@shikijs/themes/night-owl"),
  "night-owl-light": () => import("@shikijs/themes/night-owl-light"),
  nord: () => import("@shikijs/themes/nord"),
  "one-dark-pro": () => import("@shikijs/themes/one-dark-pro"),
  "one-light": () => import("@shikijs/themes/one-light"),
  "rose-pine-dawn": () => import("@shikijs/themes/rose-pine-dawn"),
  "rose-pine-moon": () => import("@shikijs/themes/rose-pine-moon"),
  "solarized-dark": () => import("@shikijs/themes/solarized-dark"),
  "solarized-light": () => import("@shikijs/themes/solarized-light"),
  "tokyo-night": () => import("@shikijs/themes/tokyo-night"),
  "vitesse-dark": () => import("@shikijs/themes/vitesse-dark"),
  "vitesse-light": () => import("@shikijs/themes/vitesse-light"),
};

interface ThemeAnchors {
  foreground: string;
  sidebar?: string;
  surface: string;
}

export function themeAnchors(
  colors: Record<string, string> | undefined
): ThemeAnchors | null {
  const surface = colors?.["editor.background"];
  const foreground = colors?.["editor.foreground"];
  if (!(surface && foreground)) {
    return null;
  }
  return { surface, foreground, sidebar: colors?.["sideBar.background"] };
}

const mix = (a: string, percent: number, b: string) =>
  `color-mix(in oklab, ${a} ${percent}%, ${b})`;

function darkModeVars({ surface, foreground, sidebar }: ThemeAnchors) {
  const border = mix(foreground, 17, "transparent");
  const raised = mix(surface, 89, foreground);
  return {
    "--background": mix(surface, 78, "black"),
    "--foreground": foreground,
    "--card": surface,
    "--card-foreground": foreground,
    "--popover": surface,
    "--popover-foreground": foreground,
    "--secondary": raised,
    "--secondary-foreground": foreground,
    "--muted": mix(surface, 90, foreground),
    "--muted-foreground": mix(foreground, 62, surface),
    "--accent": raised,
    "--accent-foreground": foreground,
    "--border": border,
    "--input": mix(foreground, 20, "transparent"),
    "--sidebar": sidebar ?? mix(surface, 84, "black"),
    "--sidebar-foreground": foreground,
    "--sidebar-accent": raised,
    "--sidebar-accent-foreground": foreground,
    "--sidebar-border": border,
  };
}

function lightModeVars({ surface, foreground, sidebar }: ThemeAnchors) {
  const border = mix(foreground, 10, surface);
  const raised = mix(surface, 96, foreground);
  return {
    "--background": mix(surface, 98, "black"),
    "--foreground": foreground,
    "--card": surface,
    "--card-foreground": foreground,
    "--popover": surface,
    "--popover-foreground": foreground,
    "--secondary": raised,
    "--secondary-foreground": foreground,
    "--muted": raised,
    "--muted-foreground": mix(foreground, 70, surface),
    "--accent": raised,
    "--accent-foreground": foreground,
    "--border": border,
    "--input": border,
    "--sidebar": sidebar ?? mix(surface, 97, foreground),
    "--sidebar-foreground": foreground,
    "--sidebar-accent": raised,
    "--sidebar-accent-foreground": foreground,
    "--sidebar-border": border,
  };
}

function cssBlock(selector: string, vars: Record<string, string>) {
  const lines = Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");
  return `${selector} {\n${lines}\n}`;
}

export function mirroredThemeCss(light: ThemeAnchors, dark: ThemeAnchors) {
  return [
    cssBlock(":root", lightModeVars(light)),
    cssBlock(".dark", darkModeVars(dark)),
  ].join("\n");
}

async function loadAnchors(themeName: string) {
  const loader = THEME_LOADERS[themeName];
  if (!loader) {
    return null;
  }
  const module = await loader();
  return themeAnchors(module.default.colors);
}

export async function loadMirroredCss(themes?: {
  dark: string;
  light: string;
}) {
  if (!themes) {
    return null;
  }
  const [light, dark] = await Promise.all([
    loadAnchors(themes.light),
    loadAnchors(themes.dark),
  ]);
  return light && dark ? mirroredThemeCss(light, dark) : null;
}

export function mirroredThemeQuery(themes?: { dark: string; light: string }) {
  return queryOptions({
    queryKey: keys.mirroredTheme(themes?.light, themes?.dark),
    queryFn: () => loadMirroredCss(themes),
    enabled: Boolean(themes),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
