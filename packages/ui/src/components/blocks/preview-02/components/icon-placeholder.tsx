"use client";

import * as PhosphorIcons from "@phosphor-icons/react";
import { Square } from "@phosphor-icons/react";
import type { ComponentProps } from "react";

type IconComponent = (props: ComponentProps<"svg">) => React.ReactNode;

type IconPlaceholderProps = {
  phosphor?: string;
  lucide?: string;
  tabler?: string;
  hugeicons?: string;
  remixicon?: string;
} & ComponentProps<"svg">;

// Local stand-in for the shadcn multi-library icon renderer. This project
// uses Phosphor, so we resolve the `phosphor` name against the icon set and
// fall back to a neutral square when a name is missing.
function IconPlaceholder({
  phosphor,
  lucide: _lucide,
  tabler: _tabler,
  hugeicons: _hugeicons,
  remixicon: _remixicon,
  ...props
}: IconPlaceholderProps) {
  const icons = PhosphorIcons as unknown as Record<string, IconComponent>;
  const Icon = phosphor ? icons[phosphor] : undefined;
  if (!Icon) {
    return <Square {...props} />;
  }
  return <Icon {...props} />;
}

export { IconPlaceholder };
