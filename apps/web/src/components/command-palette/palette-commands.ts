import type { QueuePull, RepoFlow } from "@sphynx/schema/review-queue";

export type PaletteMode = "root" | "repos" | "pulls" | "code-theme" | "files";

export interface PaletteCommand {
  checked?: boolean;
  hint?: string;
  iconKey?: PaletteIconKey;
  id: string;
  keywords?: readonly string[];
  label: string;
  mode?: PaletteMode;
  monoHint?: boolean;
  run?: () => void;
  shortcut?: readonly string[];
}

export interface PaletteGroup {
  commands: readonly PaletteCommand[];
  id: string;
  label: string;
}

export interface PalettePage {
  commands: readonly PaletteCommand[];
  id: PaletteMode;
  placeholder: string;
}

export interface PaletteContribution {
  groups?: readonly PaletteGroup[];
  pages?: readonly PalettePage[];
}

type PaletteIconKey =
  | "block"
  | "code-theme"
  | "copy"
  | "dashboard"
  | "diff"
  | "file"
  | "github"
  | "merge"
  | "pull"
  | "repo"
  | "search"
  | "settings"
  | "conversation"
  | "theme"
  | "viewed"
  | "workbench";

const GROUP_ORDER = [
  "pull-request",
  "dashboard",
  "pulls",
  "navigation",
  "preferences",
] as const;

export function mergeGroups(
  builtIn: readonly PaletteGroup[],
  contributions: readonly PaletteContribution[]
): PaletteGroup[] {
  const byId = new Map<string, PaletteGroup>();
  const insert = (group: PaletteGroup) => {
    const current = byId.get(group.id);
    byId.set(
      group.id,
      current
        ? { ...current, commands: [...current.commands, ...group.commands] }
        : group
    );
  };
  for (const group of builtIn) {
    insert(group);
  }
  for (const contribution of contributions) {
    for (const group of contribution.groups ?? []) {
      insert(group);
    }
  }
  const rank = (id: string) => {
    const index = GROUP_ORDER.indexOf(id as (typeof GROUP_ORDER)[number]);
    return index === -1 ? GROUP_ORDER.length : index;
  };
  return [...byId.values()]
    .filter((group) => group.commands.length > 0)
    .sort((a, b) => rank(a.id) - rank(b.id));
}

export function resolvePage(
  mode: PaletteMode,
  builtIn: readonly PalettePage[],
  contributions: readonly PaletteContribution[]
): PalettePage | null {
  for (const contribution of contributions) {
    const page = contribution.pages?.find((candidate) => candidate.id === mode);
    if (page) {
      return page;
    }
  }
  return builtIn.find((candidate) => candidate.id === mode) ?? null;
}

export function escapeTarget(mode: PaletteMode): "close" | "root" {
  return mode === "root" ? "close" : "root";
}

export function buildRepoCommands(
  flows: readonly RepoFlow[],
  onSelect: (key: string) => void
): PaletteCommand[] {
  return flows
    .filter((flow) => flow.openPulls.length > 0)
    .sort((a, b) => b.openPulls.length - a.openPulls.length)
    .map((flow) => {
      const key = `${flow.owner}/${flow.repo}`;
      return {
        id: `repo-${key}`,
        label: key,
        iconKey: "repo" as const,
        hint: `${flow.openPulls.length} open`,
        keywords: [flow.owner, flow.repo],
        monoHint: false,
        run: () => onSelect(key),
      };
    });
}

export function buildPullCommands(
  flows: readonly RepoFlow[],
  onSelect: (pull: QueuePull) => void
): PaletteCommand[] {
  const commands: PaletteCommand[] = [];
  for (const flow of flows) {
    for (const pull of flow.openPulls) {
      commands.push({
        id: `pull-${flow.owner}/${flow.repo}#${pull.number}`,
        label: `#${pull.number} ${pull.title}`,
        iconKey: "pull",
        hint: `${flow.owner}/${flow.repo}`,
        monoHint: true,
        keywords: [
          String(pull.number),
          flow.repo,
          pull.author?.login ?? "",
          pull.headRefName,
        ],
        run: () => onSelect(pull),
      });
    }
  }
  return commands;
}

export function buildCodeThemeCommands(
  themes: Readonly<Record<string, { label: string }>>,
  currentId: string,
  onSelect: (id: string) => void
): PaletteCommand[] {
  return Object.entries(themes).map(([id, theme]) => ({
    id: `code-theme-${id}`,
    label: theme.label,
    checked: id === currentId,
    keywords: [id],
    run: () => onSelect(id),
  }));
}

interface DashboardCommandInput {
  authed: boolean;
  focusedPull: QueuePull | null;
  onBlock: () => void;
  onFocusSearch: () => void;
  onMerge: () => void;
  onNextRepo: () => void;
  onOpenPull: () => void;
  onPrevRepo: () => void;
  onToggleWorkbench: () => void;
}

export function buildDashboardGroup(
  input: DashboardCommandInput
): PaletteGroup {
  const canDecide =
    input.authed &&
    input.focusedPull !== null &&
    input.focusedPull.state === "open";
  const commands: PaletteCommand[] = [
    {
      id: "dashboard-workbench",
      label: "Toggle workbench",
      iconKey: "workbench",
      shortcut: ["W"],
      run: input.onToggleWorkbench,
    },
    {
      id: "dashboard-search",
      label: "Search pulls",
      iconKey: "search",
      shortcut: ["/"],
      run: input.onFocusSearch,
    },
    {
      id: "dashboard-next-repo",
      label: "Next repository",
      iconKey: "repo",
      shortcut: ["]"],
      run: input.onNextRepo,
    },
    {
      id: "dashboard-prev-repo",
      label: "Previous repository",
      iconKey: "repo",
      shortcut: ["["],
      run: input.onPrevRepo,
    },
  ];
  if (input.focusedPull) {
    commands.unshift({
      id: "dashboard-open-pull",
      label: `Open #${input.focusedPull.number}`,
      iconKey: "pull",
      shortcut: ["P"],
      hint: input.focusedPull.title,
      run: input.onOpenPull,
    });
  }
  if (canDecide) {
    commands.push(
      {
        id: "dashboard-merge",
        label: `Merge #${input.focusedPull?.number}`,
        iconKey: "merge",
        shortcut: ["M"],
        run: input.onMerge,
      },
      {
        id: "dashboard-block",
        label: `Block #${input.focusedPull?.number}`,
        iconKey: "block",
        shortcut: ["B"],
        run: input.onBlock,
      }
    );
  }
  return { id: "dashboard", label: "Dashboard", commands };
}

interface PullRequestCommandInput {
  branch: string;
  filePaths: readonly string[];
  githubUrl: string;
  onCopyBranch: () => void;
  onJumpToFile: (path: string) => void;
  onMarkAllViewed: () => void;
  onOpenGithub: () => void;
  onSwitchTab: (tab: "conversation" | "diff") => void;
}

export function buildPullRequestContribution(
  input: PullRequestCommandInput
): PaletteContribution {
  return {
    groups: [
      {
        id: "pull-request",
        label: "Pull request",
        commands: [
          {
            id: "pr-tab-diff",
            label: "Switch to diff",
            iconKey: "diff",
            shortcut: ["D"],
            run: () => input.onSwitchTab("diff"),
          },
          {
            id: "pr-tab-conversation",
            label: "Switch to conversation",
            iconKey: "conversation",
            shortcut: ["C"],
            run: () => input.onSwitchTab("conversation"),
          },
          {
            id: "pr-jump-file",
            label: "Jump to file",
            iconKey: "file",
            mode: "files",
          },
          {
            id: "pr-mark-viewed",
            label: "Mark all files viewed",
            iconKey: "viewed",
            run: input.onMarkAllViewed,
          },
          {
            id: "pr-open-github",
            label: "Open on GitHub",
            iconKey: "github",
            run: input.onOpenGithub,
          },
          {
            id: "pr-copy-branch",
            label: "Copy branch name",
            iconKey: "copy",
            hint: input.branch,
            monoHint: true,
            run: input.onCopyBranch,
          },
        ],
      },
    ],
    pages: [
      {
        id: "files",
        placeholder: "Search files",
        commands: input.filePaths.map((path) => ({
          id: `pr-file-${path}`,
          label: path,
          iconKey: "file" as const,
          monoHint: true,
          run: () => input.onJumpToFile(path),
        })),
      },
    ],
  };
}

interface GlobalCommandInput {
  hasPipeline: boolean;
  onDashboard: () => void;
  onSettings: (() => void) | null;
  onToggleTheme: () => void;
  showDashboardLink: boolean;
}

export function buildGlobalGroups(input: GlobalCommandInput): PaletteGroup[] {
  const pulls: PaletteCommand[] = input.hasPipeline
    ? [
        {
          id: "go-to-pull",
          label: "Go to pull",
          iconKey: "pull",
          mode: "pulls",
        },
      ]
    : [];
  const navigation: PaletteCommand[] = [];
  if (input.showDashboardLink) {
    navigation.push({
      id: "go-dashboard",
      label: "Go to dashboard",
      iconKey: "dashboard",
      run: input.onDashboard,
    });
  }
  if (input.hasPipeline) {
    navigation.push({
      id: "switch-repo",
      label: "Switch repository",
      iconKey: "repo",
      mode: "repos",
    });
  }
  const preferences: PaletteCommand[] = [
    {
      id: "toggle-theme",
      label: "Toggle theme",
      iconKey: "theme",
      keywords: ["dark", "light"],
      run: input.onToggleTheme,
    },
    {
      id: "code-theme",
      label: "Change code theme",
      iconKey: "code-theme",
      mode: "code-theme",
    },
  ];
  if (input.onSettings) {
    preferences.push({
      id: "open-settings",
      label: "Open settings",
      iconKey: "settings",
      run: input.onSettings,
    });
  }
  return [
    { id: "pulls", label: "Pulls", commands: pulls },
    { id: "navigation", label: "Navigation", commands: navigation },
    { id: "preferences", label: "Preferences", commands: preferences },
  ];
}
