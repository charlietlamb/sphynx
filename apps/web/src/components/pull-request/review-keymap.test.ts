import { describe, expect, test } from "bun:test";
import {
  compileKeymap,
  DEFAULT_KEYMAP,
  keymapHelp,
  REVIEW_COMMANDS,
} from "./review-keymap";

describe("compileKeymap", () => {
  test("splits chords into singles, sequences, and ctrl bindings", () => {
    const compiled = compileKeymap(DEFAULT_KEYMAP);

    expect(compiled.singles.j).toBe("move-down");
    expect(compiled.singles["S-Enter"]).toBe("mark-viewed");
    expect(compiled.sequences.g.g).toBe("jump-top");
    expect(compiled.sequences.z.t).toBe("align-top");
    expect(compiled.ctrl.d).toBe("half-page-down");
    expect(compiled.ctrl.o).toBe("call-site");
  });

  test("every keymap entry points at a registered command", () => {
    for (const command of Object.values(DEFAULT_KEYMAP)) {
      expect(REVIEW_COMMANDS[command]).toBeDefined();
    }
  });

  test("help entries render chords in display notation", () => {
    const help = keymapHelp(DEFAULT_KEYMAP);
    const chords = help.map((entry) => entry.chord);
    expect(chords).toContain("gg");
    expect(chords).toContain("Ctrl-d");
    expect(chords).toContain("Shift-Enter");
  });
});
