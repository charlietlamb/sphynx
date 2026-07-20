import { describe, expect, test } from "bun:test";
import type { RepoFlow } from "@sphynx/schema/review-queue";
import {
  buildCodeThemeCommands,
  buildPullCommands,
  buildRepoCommands,
  escapeTarget,
  mergeGroups,
  resolvePage,
} from "./palette-commands";

const pull = (number: number, title: string) =>
  ({
    number,
    title,
    author: { login: "octocat", avatarUrl: "" },
    headRefName: "feature",
  }) as unknown as RepoFlow["openPulls"][number];

const flow = (owner: string, repo: string, pulls: number[]) =>
  ({
    owner,
    repo,
    stages: [],
    gaps: [],
    openPulls: pulls.map((number) => pull(number, `Pull ${number}`)),
  }) as unknown as RepoFlow;

describe("buildRepoCommands", () => {
  test("sorts by open pulls and skips empty repos", () => {
    const selected: string[] = [];
    const commands = buildRepoCommands(
      [
        flow("a", "small", [1]),
        flow("b", "big", [1, 2, 3]),
        flow("c", "none", []),
      ],
      (key) => selected.push(key)
    );
    expect(commands.map((command) => command.label)).toEqual([
      "b/big",
      "a/small",
    ]);
    commands[0]?.run?.();
    expect(selected).toEqual(["b/big"]);
    expect(commands[0]?.hint).toBe("3 open");
  });
});

describe("buildPullCommands", () => {
  test("flattens pulls with searchable keywords", () => {
    const commands = buildPullCommands(
      [flow("a", "repo", [12, 34])],
      () => undefined
    );
    expect(commands).toHaveLength(2);
    expect(commands[0]?.label).toBe("#12 Pull 12");
    expect(commands[0]?.hint).toBe("a/repo");
    expect(commands[0]?.keywords).toContain("12");
    expect(commands[0]?.keywords).toContain("octocat");
  });
});

describe("buildCodeThemeCommands", () => {
  test("marks the current theme checked", () => {
    const commands = buildCodeThemeCommands(
      { pierre: { label: "Pierre" }, ayu: { label: "Ayu" } },
      "ayu",
      () => undefined
    );
    expect(
      commands.find((command) => command.id === "code-theme-ayu")?.checked
    ).toBe(true);
    expect(
      commands.find((command) => command.id === "code-theme-pierre")?.checked
    ).toBe(false);
  });
});

describe("mergeGroups", () => {
  const command = (id: string) => ({ id, label: id, run: () => undefined });

  test("orders by GROUP_ORDER, merges by id, drops empty", () => {
    const merged = mergeGroups(
      [
        { id: "preferences", label: "Preferences", commands: [command("p")] },
        { id: "pulls", label: "Pulls", commands: [] },
      ],
      [
        {
          groups: [
            { id: "dashboard", label: "Dashboard", commands: [command("d")] },
            {
              id: "preferences",
              label: "Preferences",
              commands: [command("x")],
            },
          ],
        },
      ]
    );
    expect(merged.map((group) => group.id)).toEqual([
      "dashboard",
      "preferences",
    ]);
    expect(
      merged
        .find((group) => group.id === "preferences")
        ?.commands.map((entry) => entry.id)
    ).toEqual(["p", "x"]);
  });
});

describe("resolvePage", () => {
  test("prefers contributed pages and falls back to built-in", () => {
    const builtIn = [
      {
        id: "repos" as const,
        placeholder: "Search repositories",
        commands: [],
      },
    ];
    const contributions = [
      {
        pages: [
          { id: "files" as const, placeholder: "Search files", commands: [] },
        ],
      },
    ];
    expect(resolvePage("files", builtIn, contributions)?.placeholder).toBe(
      "Search files"
    );
    expect(resolvePage("repos", builtIn, contributions)?.placeholder).toBe(
      "Search repositories"
    );
    expect(resolvePage("pulls", builtIn, contributions)).toBeNull();
  });
});

describe("escapeTarget", () => {
  test("closes at root and returns to root from pages", () => {
    expect(escapeTarget("root")).toBe("close");
    expect(escapeTarget("files")).toBe("root");
  });
});
