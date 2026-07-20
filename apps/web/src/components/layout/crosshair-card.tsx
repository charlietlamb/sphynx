import type { ReactNode } from "react";

/**
 * A panel whose borders run off the viewport in both directions, so the card
 * reads as an intersection of the page's rules rather than a floating box.
 * Used for the signed-out surfaces that sit on the dithered backdrop.
 */
export function CrosshairCard({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-full max-w-sm bg-background p-8 before:absolute before:top-[-9999px] before:bottom-0 before:left-0 before:w-px before:bg-border before:content-[''] after:absolute after:top-0 after:right-0 after:bottom-[-9999px] after:w-px after:bg-border after:content-['']">
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 left-[-9999px] h-px bg-border"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-[-9999px] bottom-0 left-0 h-px bg-border"
      />
      {children}
    </div>
  );
}
