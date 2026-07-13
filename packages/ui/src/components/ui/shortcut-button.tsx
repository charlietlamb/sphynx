import { Button } from "@sphynx/ui/components/ui/button";
import { Kbd } from "@sphynx/ui/components/ui/kbd";
import { cn } from "@sphynx/ui/lib/utils";
import { isMac, useShortcut } from "@sphynx/ui/hooks/use-shortcut";
import type { ComponentProps } from "react";

interface ShortcutButtonProps extends ComponentProps<typeof Button> {
  metaShortcut?: string;
  singleShortcut?: string;
}

const SHORTCUT_GLYPHS: Record<string, string> = {
  enter: "↵",
  backspace: "⌫",
  escape: "Esc",
};

function shortcutGlyph(key: string) {
  return SHORTCUT_GLYPHS[key] ?? key.toUpperCase();
}

// biome-ignore lint/suspicious/noExplicitAny: keyboard-triggered click has no real DOM event
const SYNTHETIC_CLICK = { preventBaseUIHandler: () => undefined } as any;

export function ShortcutButton({
  metaShortcut,
  singleShortcut,
  children,
  className,
  disabled,
  onClick,
  ...props
}: ShortcutButtonProps) {
  const key = metaShortcut ?? singleShortcut;

  useShortcut(key ?? "", {
    meta: Boolean(metaShortcut),
    disabled: disabled || !key,
    onTrigger: () => onClick?.(SYNTHETIC_CLICK),
  });

  return (
    <Button
      className={cn("gap-1.5", className)}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
      {key ? (
        <span className="flex items-center gap-0.5">
          {metaShortcut ? <Kbd>{isMac() ? "⌘" : "Ctrl"}</Kbd> : null}
          <Kbd>{shortcutGlyph(key)}</Kbd>
        </span>
      ) : null}
    </Button>
  );
}
