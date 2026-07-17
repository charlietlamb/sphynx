import { describe, expect, test } from "bun:test";
import { mirroredThemeCss, themeAnchors } from "@/lib/mirrored-theme";

describe("themeAnchors", () => {
  test("extracts surface, foreground, and sidebar", () => {
    expect(
      themeAnchors({
        "editor.background": "#282A36",
        "editor.foreground": "#F8F8F2",
        "sideBar.background": "#21222C",
      })
    ).toEqual({
      surface: "#282A36",
      foreground: "#F8F8F2",
      sidebar: "#21222C",
    });
  });

  test("returns null when the editor anchors are missing", () => {
    expect(themeAnchors({ "editor.background": "#fff" })).toBeNull();
    expect(themeAnchors(undefined)).toBeNull();
  });
});

describe("mirroredThemeCss", () => {
  const light = { surface: "#FFFFFF", foreground: "#24292F" };
  const dark = {
    surface: "#282A36",
    foreground: "#F8F8F2",
    sidebar: "#21222C",
  };

  test("emits light overrides on :root and dark overrides on .dark", () => {
    const css = mirroredThemeCss(light, dark);
    expect(css).toStartWith(":root {");
    expect(css).toContain(".dark {");
    expect(css).toContain("--card: #282A36;");
    expect(css).toContain("--sidebar: #21222C;");
    expect(css).toContain(
      "--background: color-mix(in oklab, #282A36 78%, black);"
    );
  });

  test("derives a sidebar when the theme has none", () => {
    const css = mirroredThemeCss(light, { ...dark, sidebar: undefined });
    expect(css).toContain(
      "--sidebar: color-mix(in oklab, #282A36 84%, black);"
    );
  });

  test("never overrides the accent or diff tokens", () => {
    const css = mirroredThemeCss(light, dark);
    expect(css).not.toContain("--primary:");
    expect(css).not.toContain("--ring:");
    expect(css).not.toContain("--addition:");
    expect(css).not.toContain("--deletion:");
  });
});
