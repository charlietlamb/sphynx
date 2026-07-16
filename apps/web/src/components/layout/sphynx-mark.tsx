import { cn } from "@sphynx/ui/lib/utils";

export function SphynxMark({ className }: { className?: string }) {
  return (
    <svg
      aria-label="Sphynx"
      className={cn("size-7 text-foreground", className)}
      fill="currentColor"
      role="img"
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M2 2 L13 12 L16 10 L19 12 L30 2 L27 18 L16 31 L5 18 Z" />
    </svg>
  );
}
