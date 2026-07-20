import {
  ArrowSquareOutIcon,
  ChatCircleIcon,
  CheckCircleIcon,
  CopyIcon,
  FileCodeIcon,
  GearIcon,
  GitDiffIcon,
  GitMergeIcon,
  GitPullRequestIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  PaletteIcon,
  ProhibitIcon,
  SquaresFourIcon,
  StackIcon,
  ToolboxIcon,
} from "@phosphor-icons/react";
import type { QueuePull } from "@sphynx/schema/review-queue";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@sphynx/ui/components/ui/command";
import { Kbd } from "@sphynx/ui/components/ui/kbd";
import { cn } from "@sphynx/ui/lib/utils";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useTheme } from "next-themes";
import { Fragment, type ReactNode, useMemo, useState } from "react";
import { useCommandPalette } from "@/components/command-palette/command-palette-context";
import {
  buildCodeThemeCommands,
  buildGlobalGroups,
  buildPullCommands,
  buildRepoCommands,
  escapeTarget,
  mergeGroups,
  type PaletteCommand,
  type PalettePage,
  resolvePage,
} from "@/components/command-palette/palette-commands";
import { usePipeline } from "@/components/dashboard/use-pipeline";
import { FileTypeIcon } from "@/components/pull-request/file-type-icon";
import { useSettings } from "@/components/settings/settings-provider";
import { useSession } from "@/lib/auth-client";
import { CODE_THEMES } from "@/lib/settings";

const ICONS: Record<string, ReactNode> = {
  block: <ProhibitIcon weight="fill" />,
  "code-theme": <PaletteIcon weight="fill" />,
  copy: <CopyIcon weight="fill" />,
  dashboard: <SquaresFourIcon weight="fill" />,
  diff: <GitDiffIcon weight="fill" />,
  file: <FileCodeIcon weight="fill" />,
  github: <ArrowSquareOutIcon weight="fill" />,
  merge: <GitMergeIcon weight="fill" />,
  pull: <GitPullRequestIcon weight="fill" />,
  repo: <StackIcon weight="fill" />,
  search: <MagnifyingGlassIcon weight="fill" />,
  settings: <GearIcon weight="fill" />,
  conversation: <ChatCircleIcon weight="fill" />,
  theme: <MoonIcon weight="fill" />,
  viewed: <CheckCircleIcon weight="fill" />,
  workbench: <ToolboxIcon weight="fill" />,
};

function commandIcon(command: PaletteCommand) {
  if (command.id.startsWith("pr-file-")) {
    return <FileTypeIcon className="size-3.5" path={command.label} />;
  }
  return command.iconKey ? (
    <span className="text-muted-foreground">{ICONS[command.iconKey]}</span>
  ) : null;
}

function PaletteItem({
  command,
  onRun,
}: {
  command: PaletteCommand;
  onRun: (command: PaletteCommand) => void;
}) {
  return (
    <CommandItem
      data-checked={command.checked ? "true" : undefined}
      keywords={command.keywords ? [...command.keywords] : undefined}
      onSelect={() => onRun(command)}
      value={command.id}
    >
      {commandIcon(command)}
      <span
        className={cn(
          "min-w-0 truncate",
          command.monoHint && !command.hint && "font-mono text-[11px]"
        )}
      >
        {command.label}
      </span>
      {command.hint ? (
        <span
          className={cn(
            "ml-auto min-w-0 truncate text-[11px] text-muted-foreground",
            command.monoHint && "font-mono"
          )}
        >
          {command.hint}
        </span>
      ) : null}
      {command.shortcut ? (
        <CommandShortcut className="flex items-center gap-1 tracking-normal">
          {command.shortcut.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </CommandShortcut>
      ) : null}
    </CommandItem>
  );
}

export default function CommandPalette() {
  const { contributions, mode, open, setMode, setOpen } = useCommandPalette();
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const { data: session } = useSession();
  const authed = Boolean(session?.user);
  const pipeline = usePipeline(null, open && authed);
  const { settings, update } = useSettings();
  const { resolvedTheme, setTheme } = useTheme();

  const runCommand = (command: PaletteCommand) => {
    if (command.mode) {
      setMode(command.mode);
      setQuery("");
      return;
    }
    setOpen(false);
    const { run } = command;
    if (run) {
      requestAnimationFrame(() => requestAnimationFrame(run));
    }
  };

  const goToRoot = () => {
    setMode("root");
    setQuery("");
  };

  const flows = useMemo(() => pipeline.data?.repos ?? [], [pipeline.data]);

  const groups = useMemo(
    () =>
      mergeGroups(
        buildGlobalGroups({
          hasPipeline: flows.length > 0,
          onDashboard: () => navigate({ to: "/" }),
          onSettings: null,
          onToggleTheme: () =>
            setTheme(resolvedTheme === "dark" ? "light" : "dark"),
          showDashboardLink: pathname !== "/",
        }),
        contributions
      ),
    [flows.length, navigate, setTheme, resolvedTheme, pathname, contributions]
  );

  const pages = useMemo<PalettePage[]>(
    () => [
      {
        id: "repos",
        placeholder: "Search repositories",
        commands: buildRepoCommands(flows, (key) => {
          update({ selectedRepo: `${key}` });
          if (pathname !== "/") {
            navigate({ to: "/" });
          }
        }),
      },
      {
        id: "pulls",
        placeholder: "Search pulls",
        commands: buildPullCommands(flows, (pull: QueuePull) =>
          navigate({
            to: "/$owner/$repo/pull/$number",
            params: { owner: pull.owner, repo: pull.repo, number: pull.number },
          })
        ),
      },
      {
        id: "code-theme",
        placeholder: "Search themes",
        commands: buildCodeThemeCommands(
          CODE_THEMES,
          settings.codeTheme,
          (id) => update({ codeTheme: `${id}` })
        ),
      },
    ],
    [flows, update, pathname, navigate, settings.codeTheme]
  );

  const page = mode === "root" ? null : resolvePage(mode, pages, contributions);

  return (
    <CommandDialog
      onOpenChange={(next, details) => {
        if (
          !next &&
          details?.reason === "escape-key" &&
          escapeTarget(mode) === "root"
        ) {
          goToRoot();
          return;
        }
        setOpen(next);
      }}
      open={open}
    >
      <Command className="sm:max-w-md">
        <CommandInput
          onKeyDown={(event) => {
            if (event.key === "Backspace" && query === "" && mode !== "root") {
              event.preventDefault();
              goToRoot();
            }
          }}
          onValueChange={setQuery}
          placeholder={page?.placeholder ?? "Type a command"}
          value={query}
        />
        <CommandList>
          <CommandEmpty>Nothing found.</CommandEmpty>
          {page ? (
            <CommandGroup>
              {page.commands.map((command) => (
                <PaletteItem
                  command={command}
                  key={command.id}
                  onRun={runCommand}
                />
              ))}
            </CommandGroup>
          ) : (
            groups.map((group, index) => (
              <Fragment key={group.id}>
                {index > 0 ? <CommandSeparator /> : null}
                <CommandGroup heading={group.label}>
                  {group.commands.map((command) => (
                    <PaletteItem
                      command={command}
                      key={command.id}
                      onRun={runCommand}
                    />
                  ))}
                </CommandGroup>
              </Fragment>
            ))
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
