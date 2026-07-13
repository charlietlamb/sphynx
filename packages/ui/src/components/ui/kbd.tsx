import { cn } from "@sphynx/ui/lib/utils";

export function Kbd({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex h-4 min-w-4 items-center justify-center rounded px-1 font-medium font-sans text-[0.625rem] text-current/70 leading-none",
        "border border-current/15 bg-current/10",
        className
      )}
    >
      {children}
    </kbd>
  );
}
