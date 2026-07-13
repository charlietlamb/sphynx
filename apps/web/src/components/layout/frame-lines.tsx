export function FrameLines() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      <span className="absolute inset-x-0 top-6 h-px bg-border/60 sm:top-9 md:top-12" />
      <span className="absolute inset-x-0 bottom-6 h-px bg-border/60 sm:bottom-9 md:bottom-12" />
      <span className="absolute inset-y-0 left-6 w-px bg-border/60 sm:left-9 md:left-12" />
      <span className="absolute inset-y-0 right-6 w-px bg-border/60 sm:right-9 md:right-12" />
    </div>
  );
}
