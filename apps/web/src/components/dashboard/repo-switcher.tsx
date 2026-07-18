import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@sphynx/ui/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@sphynx/ui/components/ui/dropdown-menu";
import { cn } from "@sphynx/ui/lib/utils";
import { useMemo } from "react";

export interface RepoOption {
  contested: number;
  key: string;
  mergeable: number;
  openCount: number;
  owner: string;
  repo: string;
}

interface RepoSwitcherProps {
  onSelect: (key: string) => void;
  repos: readonly RepoOption[];
  selected: RepoOption | null;
}

export function RepoSwitcher({ onSelect, repos, selected }: RepoSwitcherProps) {
  const owners = useMemo(() => {
    const grouped = new Map<string, RepoOption[]>();
    for (const repo of repos) {
      const list = grouped.get(repo.owner) ?? [];
      list.push(repo);
      grouped.set(repo.owner, list);
    }
    return [...grouped.entries()];
  }, [repos]);

  if (!selected) {
    return null;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group flex items-center gap-2 rounded-md border border-transparent py-1 pr-2 pl-2.5 outline-none transition-colors hover:border-border hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=open]:border-border data-[state=open]:bg-muted/30">
        <Avatar className="size-5 rounded-[4px]">
          <AvatarImage
            alt={selected.owner}
            className="rounded-[4px]"
            src={`https://github.com/${selected.owner}.png?size=40`}
          />
          <AvatarFallback className="rounded-[4px] text-[9px]">
            {selected.owner[0]}
          </AvatarFallback>
        </Avatar>
        <span className="font-heading text-lg leading-none tracking-tight">
          {selected.repo}
        </span>
        <CaretDownIcon className="size-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Find a repo…" />
          <CommandList>
            <CommandEmpty>No repos match.</CommandEmpty>
            {owners.map(([owner, entries]) => (
              <CommandGroup heading={owner} key={owner}>
                {entries.map((repo) => {
                  const active = repo.key === selected.key;
                  return (
                    <CommandItem
                      key={repo.key}
                      onSelect={() => onSelect(repo.key)}
                      value={repo.key}
                    >
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-[13px]",
                          active ? "text-foreground" : "text-foreground/90"
                        )}
                      >
                        {repo.repo}
                      </span>
                      {active ? (
                        <CheckIcon className="size-3.5 shrink-0 text-primary" />
                      ) : null}
                      <span className="shrink-0 text-right text-[11px] tabular-nums">
                        {repo.mergeable > 0 ? (
                          <>
                            <span className="text-addition">
                              {repo.mergeable}
                            </span>
                            <span className="text-muted-foreground/40">
                              {" "}
                              ·{" "}
                            </span>
                          </>
                        ) : null}
                        {repo.contested > 0 ? (
                          <>
                            <span className="text-deletion">
                              {repo.contested}
                            </span>
                            <span className="text-muted-foreground/40">
                              {" "}
                              ·{" "}
                            </span>
                          </>
                        ) : null}
                        <span className="text-muted-foreground/70">
                          {repo.openCount}
                        </span>
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
