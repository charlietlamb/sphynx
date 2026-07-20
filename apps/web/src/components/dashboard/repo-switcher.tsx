import { CaretDownIcon, CheckCircleIcon } from "@phosphor-icons/react";
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
import { QueueCounts } from "@/components/dashboard/queue-counts";

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
      <DropdownMenuTrigger className="group flex h-7 items-center gap-2 rounded-md border border-transparent px-2 outline-none transition-colors hover:border-border hover:bg-muted/30 focus-visible:border-border data-[state=open]:border-border data-[state=open]:bg-muted/30">
        <Avatar className="size-4 rounded-[4px] after:rounded-[4px]">
          <AvatarImage
            alt={selected.owner}
            className="rounded-[4px]"
            src={`https://github.com/${selected.owner}.png?size=40`}
          />
          <AvatarFallback className="rounded-[4px] text-[8px]">
            {selected.owner[0]}
          </AvatarFallback>
        </Avatar>
        <span className="font-medium text-[13px] leading-none">
          {selected.repo}
        </span>
        <CaretDownIcon
          aria-hidden
          className="size-3 shrink-0 text-muted-foreground/50 transition-[transform,color] duration-200 ease-out group-hover:text-foreground group-data-[state=open]:rotate-180"
        />
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
                      className="gap-2.5"
                      key={repo.key}
                      onSelect={() => onSelect(repo.key)}
                      value={repo.key}
                    >
                      <Avatar className="size-4 shrink-0 rounded-[4px] after:rounded-[4px]">
                        <AvatarImage
                          alt={repo.owner}
                          className="rounded-[4px]"
                          src={`https://github.com/${repo.owner}.png?size=40`}
                        />
                        <AvatarFallback className="rounded-[4px] text-[8px]">
                          {repo.owner[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-[13px]",
                          active ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {repo.repo}
                      </span>
                      <QueueCounts
                        contested={repo.contested}
                        mergeable={repo.mergeable}
                        total={repo.openCount}
                      />
                      <CheckCircleIcon
                        aria-hidden
                        className={cn(
                          "size-4 shrink-0 transition-colors",
                          active ? "text-addition" : "text-transparent"
                        )}
                        weight="fill"
                      />
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
