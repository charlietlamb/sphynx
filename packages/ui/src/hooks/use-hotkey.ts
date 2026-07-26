"use client";

import { useEffect } from "react";
import { isTypingTarget } from "@sphynx/ui/lib/typing-target";

interface UseHotkeyOptions {
  enabled?: boolean;
  /** Fire even when a modifier is held. Default only fires on the bare key. */
  allowModifiers?: boolean;
}

/**
 * Bind a single bare-key shortcut to a handler. Skips keypresses while the user
 * is typing in a field, ignores modifier chords by default, and cleans up on
 * unmount. Wraps the one legitimate use of an effect — subscribing to a global
 * event — so components stay declarative.
 */
export function useHotkey(
  key: string,
  handler: () => void,
  { enabled = true, allowModifiers = false }: UseHotkeyOptions = {}
): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) {
        return;
      }
      if (
        !allowModifiers &&
        (event.metaKey || event.ctrlKey || event.altKey)
      ) {
        return;
      }
      if (event.key?.toLowerCase() !== key.toLowerCase()) {
        return;
      }
      if (isTypingTarget(event.target)) {
        return;
      }
      event.preventDefault();
      handler();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, key, allowModifiers, handler]);
}
