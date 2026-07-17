import type { ReviewKeyHandlers } from "@/components/pull-request/use-review-keys";

const MAX_COUNT = 999;

function repeat(count: number, run: () => void) {
  const times = Math.min(Math.max(count, 1), MAX_COUNT);
  for (let index = 0; index < times; index += 1) {
    run();
  }
}

interface ReviewCommand {
  description: string;
  run: (handlers: ReviewKeyHandlers, count: number) => void;
}

export const REVIEW_COMMANDS = {
  "move-down": {
    description: "Next line (crosses files)",
    run: (h, n) => repeat(n, () => h.onMoveLine(1)),
  },
  "move-up": {
    description: "Previous line (crosses files)",
    run: (h, n) => repeat(n, () => h.onMoveLine(-1)),
  },
  "cursor-left": {
    description: "Move cursor left (pane hop at edge)",
    run: (h, n) => repeat(n, () => h.onMoveSymbol(-1)),
  },
  "cursor-right": {
    description: "Move cursor right (pane hop at edge)",
    run: (h, n) => repeat(n, () => h.onMoveSymbol(1)),
  },
  "word-next": {
    description: "Next word",
    run: (h, n) => repeat(n, () => h.onMoveWord(1)),
  },
  "word-prev": {
    description: "Previous word",
    run: (h, n) => repeat(n, () => h.onMoveWord(-1)),
  },
  "word-end": {
    description: "End of word",
    run: (h, n) => repeat(n, () => h.onMoveWordEnd()),
  },
  "hunk-next": {
    description: "Next hunk",
    run: (h, n) => repeat(n, () => h.onMoveHunk(1)),
  },
  "hunk-prev": {
    description: "Previous hunk",
    run: (h, n) => repeat(n, () => h.onMoveHunk(-1)),
  },
  "half-page-down": {
    description: "Half page down",
    run: (h, n) => repeat(n, () => h.onMovePage(1)),
  },
  "half-page-up": {
    description: "Half page up",
    run: (h, n) => repeat(n, () => h.onMovePage(-1)),
  },
  "jump-top": {
    description: "Top of file",
    run: (h) => h.onJumpEdge(-1),
  },
  "jump-bottom": {
    description: "Bottom of file",
    run: (h) => h.onJumpEdge(1),
  },
  "align-center": {
    description: "Center the current line",
    run: (h) => h.onAlignLine("center"),
  },
  "align-top": {
    description: "Current line to the top",
    run: (h) => h.onAlignLine("top"),
  },
  "align-bottom": {
    description: "Current line to the bottom",
    run: (h) => h.onAlignLine("end"),
  },
  "open-symbol": {
    description: "Open the symbol under the cursor",
    run: (h) => h.onOpenSymbol(),
  },
  "file-next": {
    description: "Next file",
    run: (h, n) => repeat(n, () => h.onNextFile()),
  },
  "file-prev": {
    description: "Previous file",
    run: (h, n) => repeat(n, () => h.onPrevFile()),
  },
  "focus-left": {
    description: "Focus the left column",
    run: (h) => h.onFocusColumn(0),
  },
  "focus-right": {
    description: "Focus the right column",
    run: (h) => h.onFocusColumn(1),
  },
  hints: {
    description: "Hint mode — open a definition",
    run: (h) => h.onStartHints(),
  },
  "pop-definition": {
    description: "Pop the last definition",
    run: (h) => h.onPopTrail(),
  },
  "call-site": {
    description: "Jump to the call site",
    run: (h) => h.onJumpToCallSite(),
  },
  visual: {
    description: "Visual select — motions extend",
    run: (h) => h.onToggleVisual(),
  },
  yank: {
    description: "Copy line / selection with reference",
    run: (h) => h.onYank(),
  },
  comment: {
    description: "Comment on line / selection",
    run: (h) => h.onComment(),
  },
  "mark-viewed": {
    description: "Mark file viewed and advance",
    run: (h) => h.onMarkViewed(),
  },
  "toggle-sidebar": {
    description: "Toggle file sidebar",
    run: (h) => h.onToggleSidebar(),
  },
  help: {
    description: "Toggle this help",
    run: (h) => h.onToggleHelp(),
  },
} satisfies Record<string, ReviewCommand>;

export type ReviewCommandId = keyof typeof REVIEW_COMMANDS;

export const DEFAULT_KEYMAP: Record<string, ReviewCommandId> = {
  j: "move-down",
  k: "move-up",
  h: "cursor-left",
  l: "cursor-right",
  w: "word-next",
  b: "word-prev",
  e: "word-end",
  "{": "hunk-prev",
  "}": "hunk-next",
  "C-d": "half-page-down",
  "C-u": "half-page-up",
  "g g": "jump-top",
  G: "jump-bottom",
  "z z": "align-center",
  "z t": "align-top",
  "z b": "align-bottom",
  Enter: "open-symbol",
  J: "file-next",
  K: "file-prev",
  H: "focus-left",
  L: "focus-right",
  f: "hints",
  u: "pop-definition",
  "C-o": "call-site",
  v: "visual",
  y: "yank",
  c: "comment",
  "C-b": "toggle-sidebar",
  "S-Enter": "mark-viewed",
  "?": "help",
};

export interface CompiledKeymap {
  ctrl: Record<string, ReviewCommandId>;
  sequences: Record<string, Record<string, ReviewCommandId>>;
  singles: Record<string, ReviewCommandId>;
}

export function compileKeymap(
  keymap: Record<string, ReviewCommandId>
): CompiledKeymap {
  const compiled: CompiledKeymap = { ctrl: {}, sequences: {}, singles: {} };
  for (const [chord, command] of Object.entries(keymap)) {
    const steps = chord.split(" ");
    if (steps.length === 2) {
      compiled.sequences[steps[0]] = {
        ...compiled.sequences[steps[0]],
        [steps[1]]: command,
      };
      continue;
    }
    if (steps[0].startsWith("C-")) {
      compiled.ctrl[steps[0].slice(2)] = command;
      continue;
    }
    compiled.singles[steps[0]] = command;
  }
  return compiled;
}

function displayChord(chord: string) {
  return chord
    .replaceAll(" ", "")
    .replace("C-", "Ctrl-")
    .replace("S-", "Shift-");
}

export function keymapHelp(keymap: Record<string, ReviewCommandId>) {
  return Object.entries(keymap).map(([chord, command]) => ({
    chord: displayChord(chord),
    description: REVIEW_COMMANDS[command].description,
  }));
}
