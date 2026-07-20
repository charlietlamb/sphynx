import { CaretDownIcon, CheckCircleIcon } from "@phosphor-icons/react";
import type { Installation } from "@sphynx/schema/review-queue";
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

interface OrgSwitcherProps {
  installations: readonly Installation[];
  onSelect: (installationId: number) => void;
  selected: Installation | null;
}

export function OrgSwitcher({
  installations,
  onSelect,
  selected,
}: OrgSwitcherProps) {
  // A switcher with one option is noise — most users have exactly one org.
  if (!selected || installations.length < 2) {
    return null;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group flex h-7 items-center gap-2 rounded-md border border-transparent px-2 outline-none transition-colors hover:border-border hover:bg-muted/30 focus-visible:border-border data-[state=open]:border-border data-[state=open]:bg-muted/30">
        <Avatar className="size-4 rounded-[4px] after:rounded-[4px]">
          <AvatarImage
            alt={selected.accountLogin}
            className="rounded-[4px]"
            src={selected.avatarUrl ?? undefined}
          />
          <AvatarFallback className="rounded-[4px] text-[8px]">
            {selected.accountLogin[0]}
          </AvatarFallback>
        </Avatar>
        <span className="text-[13px] text-muted-foreground leading-none">
          {selected.accountLogin}
        </span>
        <CaretDownIcon
          aria-hidden
          className="size-3 shrink-0 text-muted-foreground/50 transition-[transform,color] duration-200 ease-out group-hover:text-foreground group-data-[state=open]:rotate-180"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Find an organization…" />
          <CommandList>
            <CommandEmpty>No organizations match.</CommandEmpty>
            <CommandGroup>
              {installations.map((installation) => {
                const active = installation.id === selected.id;
                return (
                  <CommandItem
                    className="gap-2.5"
                    key={installation.id}
                    onSelect={() => onSelect(installation.id)}
                    value={installation.accountLogin}
                  >
                    <Avatar className="size-4 shrink-0 rounded-[4px] after:rounded-[4px]">
                      <AvatarImage
                        alt={installation.accountLogin}
                        className="rounded-[4px]"
                        src={installation.avatarUrl ?? undefined}
                      />
                      <AvatarFallback className="rounded-[4px] text-[8px]">
                        {installation.accountLogin[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-[13px]",
                        active ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {installation.accountLogin}
                    </span>
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
          </CommandList>
        </Command>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
