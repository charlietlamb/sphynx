import { cn } from "@sphynx/ui/lib/utils";
import type { ReactNode } from "react";
import { FrameLines } from "@/components/layout/frame-lines";
import { MountainTexture } from "@/components/layout/mountain-texture";
import { SiteHeader } from "@/components/layout/site-header";

interface SiteLayoutProps {
  backdrop?: ReactNode;
  center?: boolean;
  children: ReactNode;
  fill?: boolean;
  texture?: boolean;
}

export function SiteLayout({
  children,
  backdrop,
  center,
  fill,
  texture,
}: SiteLayoutProps) {
  return (
    <main
      className={cn(
        "relative overflow-hidden bg-background text-foreground",
        fill ? "h-svh" : "min-h-svh"
      )}
    >
      {texture ? (
        <MountainTexture className="absolute inset-6 sm:inset-9 md:inset-12" />
      ) : null}
      {fill ? null : <FrameLines />}
      {backdrop ? (
        <div className="absolute inset-0 z-10">{backdrop}</div>
      ) : null}
      <div
        className={cn(
          "relative z-20 flex flex-col",
          fill ? "h-svh gap-1 px-4 pt-2 pb-4" : "min-h-svh p-6 sm:p-9 md:p-12"
        )}
      >
        {fill ? null : <SiteHeader />}
        <div
          className={cn(
            "flex flex-1 flex-col",
            fill && "min-h-0",
            center && "items-center justify-center"
          )}
        >
          {children}
        </div>
      </div>
    </main>
  );
}
