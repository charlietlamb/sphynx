"use client";

import { ShortcutButton } from "@sphynx/ui/components/ui/shortcut-button";
import { useFormContext } from "@sphynx/ui/hooks/form-context";
import { cn } from "@sphynx/ui/lib/utils";
import type { ReactNode } from "react";

interface SubmitButtonProps {
  fullWidth?: boolean;
  icon?: ReactNode;
  label: string;
  loadingLabel?: string;
  shortcut?: boolean;
}

export function SubmitButton({
  fullWidth = true,
  icon,
  label,
  loadingLabel = "Please wait…",
  shortcut = true,
}: SubmitButtonProps) {
  const form = useFormContext();

  return (
    <form.Subscribe
      selector={(state) => ({
        isSubmitting: state.isSubmitting,
        canSubmit: state.canSubmit,
      })}
    >
      {({ isSubmitting, canSubmit }) => (
        <ShortcutButton
          className={cn("h-10 text-sm", fullWidth && "w-full")}
          disabled={isSubmitting || !canSubmit}
          metaShortcut={shortcut ? "enter" : undefined}
          onClick={() => form.handleSubmit()}
          size="lg"
          type="button"
        >
          {isSubmitting ? loadingLabel : label}
          {isSubmitting ? null : icon}
        </ShortcutButton>
      )}
    </form.Subscribe>
  );
}
