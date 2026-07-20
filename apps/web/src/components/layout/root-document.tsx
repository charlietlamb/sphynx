import { Providers } from "@sphynx/ui/components/providers";
import { QueryClientProvider } from "@tanstack/react-query";
import { HeadContent, Scripts } from "@tanstack/react-router";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import type { ReactNode } from "react";
import { CommandPaletteProvider } from "@/components/command-palette/command-palette-context";
import { MirroredThemeStyle } from "@/components/settings/mirrored-theme-style";
import { SettingsProvider } from "@/components/settings/settings-provider";
import { getQueryClient } from "@/lib/query/query-client";
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
          <QueryClientProvider client={getQueryClient()}>
            <Providers>
              <SettingsProvider initial={initialSettings}>
                <MirroredThemeStyle initialCss={initialMirroredCss} />
                <CommandPaletteProvider>{children}</CommandPaletteProvider>
              </SettingsProvider>
            </Providers>
          </QueryClientProvider>
        </NuqsAdapter>
        <Scripts />
      </body>
    </html>
  );
}
