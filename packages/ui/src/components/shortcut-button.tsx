import { Button } from "@sphynx/ui/components/ui/button";
import { cn } from "@sphynx/ui/lib/utils";
import type { ComponentProps } from "react";

const CHIP_VARIANTS: Record<string, string> = {
  default: "bg-primary-foreground/15 text-primary-foreground",
  outline: "bg-muted text-muted-foreground",
  secondary: "bg-muted text-muted-foreground",
  ghost: "bg-muted text-muted-foreground",
};

function ShortcutButton({
  children,
  shortcut,
  variant = "default",
  ...props
}: ComponentProps<typeof Button> & { shortcut: string }) {
  return (
    <Button variant={variant} {...props}>
      {children}
      <span
        className={cn(
          "flex h-4 min-w-4 items-center justify-center rounded-sm px-1 font-medium font-mono text-[10px]",
          CHIP_VARIANTS[variant ?? "default"] ?? CHIP_VARIANTS.outline
        )}
      >
        {shortcut}
      </span>
    </Button>
  );
}

export { ShortcutButton };
