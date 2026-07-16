import type { CodeViewHandle } from "@pierre/diffs/react";

const ANCHOR_BAND = 96;

export type Handle = CodeViewHandle<undefined> | null;

const SCROLL_PRESETS = {
  anchor: { align: "start", offset: ANCHOR_BAND, behavior: "smooth" },
  center: { align: "center", behavior: "instant" },
  nearest: { align: "nearest", behavior: "instant" },
  top: { align: "start", offset: 8, behavior: "instant" },
} as const;

export type ScrollPreset = keyof typeof SCROLL_PRESETS;

export function scrollToLine(
  handle: Handle,
  path: string,
  line: number,
  preset: ScrollPreset
) {
  handle?.scrollTo({
    type: "line",
    id: path,
    lineNumber: line,
    side: "additions",
    ...SCROLL_PRESETS[preset],
  });
}
