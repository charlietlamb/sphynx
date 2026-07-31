import { Providers } from "@sphynx/ui/components/providers";
import { HeadContent, Scripts } from "@tanstack/react-router";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import type { ReactNode } from "react";
import { DatabuddyAnalytics } from "@/components/analytics/databuddy-analytics";
import { CommandPaletteProvider } from "@/components/command-palette/command-palette-context";
import { GitHubAccessSync } from "@/components/github/github-access-sync";
import { MirroredThemeStyle } from "@/components/settings/mirrored-theme-style";
import { SettingsProvider } from "@/components/settings/settings-provider";
import { DEFAULT_SETTINGS, type ReviewSettings } from "@/lib/settings";

interface RootDocumentProps {
  children: ReactNode;
  initialMirroredCss?: string | null;
  initialSettings?: ReviewSettings;
}

export function RootDocument({
  children,
  initialMirroredCss = null,
  initialSettings = DEFAULT_SETTINGS,
}: Readonly<RootDocumentProps>) {
  return (
    <html className="font-sans antialiased" lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <NuqsAdapter>
          <Providers>
            <SettingsProvider initial={initialSettings}>
              <MirroredThemeStyle initialCss={initialMirroredCss} />
              <GitHubAccessSync />
              <CommandPaletteProvider>{children}</CommandPaletteProvider>
            </SettingsProvider>
          </Providers>
        </NuqsAdapter>
        <Scripts />
        <DatabuddyAnalytics />
      </body>
    </html>
  );
}
