import { cn } from "@sphynx/ui/lib/utils";
import type { ReactNode } from "react";
import { FrameLines } from "@/components/layout/frame-lines";
import { MountainTexture } from "@/components/layout/mountain-texture";
import { SiteHeader } from "@/components/layout/site-header";

interface SiteLayoutProps {
  backdrop?: ReactNode;
  center?: boolean;
  children: ReactNode;
  texture?: boolean;
}

export function SiteLayout({
  children,
  backdrop,
  center,
  texture,
}: SiteLayoutProps) {
  return (
    <main className="relative min-h-svh overflow-hidden bg-background text-foreground">
      {texture ? (
        <MountainTexture className="absolute inset-6 sm:inset-9 md:inset-12" />
      ) : null}
      <FrameLines />
      {backdrop ? (
        <div className="absolute inset-0 z-10">{backdrop}</div>
      ) : null}
      <div className="relative z-20 flex min-h-svh flex-col p-6 sm:p-9 md:p-12">
        <SiteHeader />
        <div
          className={cn(
            "flex flex-1 flex-col",
            center && "items-center justify-center"
          )}
        >
          {children}
        </div>
      </div>
    </main>
  );
}
