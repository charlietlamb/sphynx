import { Providers } from "@sphynx/ui/components/providers";
import { QueryClientProvider } from "@tanstack/react-query";
import { HeadContent, Scripts } from "@tanstack/react-router";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import type { ReactNode } from "react";
import { MirroredThemeStyle } from "@/components/settings/mirrored-theme-style";
import { getQueryClient } from "@/lib/query/query-client";

export function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html className="font-sans antialiased" lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <NuqsAdapter>
          <QueryClientProvider client={getQueryClient()}>
            <Providers>
              <MirroredThemeStyle />
              {children}
            </Providers>
          </QueryClientProvider>
        </NuqsAdapter>
        <Scripts />
      </body>
    </html>
  );
}
