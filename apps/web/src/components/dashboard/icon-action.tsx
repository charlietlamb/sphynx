import { Button } from "@sphynx/ui/components/ui/button";
import { Kbd } from "@sphynx/ui/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@sphynx/ui/components/ui/tooltip";
import type { ComponentProps, ReactNode } from "react";

interface IconActionProps
  extends Omit<ComponentProps<typeof Button>, "children"> {
  icon: ReactNode;
  label: string;
  shortcut?: string;
}

/**
 * An icon button whose tooltip carries the label (and its keyboard shortcut).
 * The accessible name is the label; the visible text lives in the tooltip,
 * matching the app's header icon buttons (settings gear, GitHub link).
 */
export function IconAction({
  icon,
  label,
  shortcut,
  size = "icon",
  variant = "outline",
  ...props
}: IconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button aria-label={label} size={size} variant={variant} {...props} />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut ? <Kbd>{shortcut}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
}
