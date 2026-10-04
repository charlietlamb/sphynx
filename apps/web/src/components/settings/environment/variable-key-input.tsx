import {
  type KnownVariable,
  knownVariable,
} from "@sphynx/schema/domain/known-variables";
import { Input } from "@sphynx/ui/components/input";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@sphynx/ui/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@sphynx/ui/components/ui/popover";
import { cn } from "@sphynx/ui/lib/utils";
import { type ClipboardEvent, type KeyboardEvent, useState } from "react";
import { UsedByIcon } from "@/components/settings/environment/used-by-badges";
import { knownMatches } from "@/lib/settings/known-matches";
import { usedBy } from "@/lib/settings/variable-uses";

const CLOSING = new Set(["escape-key", "outside-press"]);
const CARET_KEYS = new Set(["End", "Home"]);
const LEAVING_KEYS = new Set(["Escape", "Tab"]);

function KnownOption({ known }: { readonly known: KnownVariable }) {
  const [first] = usedBy(known.name);

  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      {first === undefined ? null : <UsedByIcon use={first} />}
      <span className="shrink-0 font-mono text-foreground">{known.name}</span>
      <span className="truncate text-muted-foreground">
        {known.description}
      </span>
    </span>
  );
}

export function VariableKeyInput({
  className,
  invalid,
  onChange,
  onPaste,
  placeholder,
  value,
}: {
  readonly className?: string;
  readonly invalid: boolean;
  readonly onChange: (value: string) => void;
  readonly onPaste: (event: ClipboardEvent<HTMLInputElement>) => void;
  readonly placeholder: string;
  readonly value: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState("");
  const matches = knownMatches(value);
  const showing = open && knownVariable(value.trim()) === undefined;
  const selected = matches.some((known) => known.name === highlight)
    ? highlight
    : (matches[0]?.name ?? "");

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  const guardKeys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (LEAVING_KEYS.has(event.key)) {
      return;
    }

    if (!showing || CARET_KEYS.has(event.key)) {
      event.stopPropagation();
    }
  };

  return (
    <Command
      className="contents"
      loop
      onValueChange={setHighlight}
      shouldFilter={false}
      value={selected}
    >
      <Popover
        onOpenChange={(next, details) => {
          if (!next && CLOSING.has(details.reason)) {
            setOpen(false);
          }
        }}
        open={showing}
      >
        <PopoverTrigger
          nativeButton={false}
          render={<div className="min-w-0" tabIndex={-1} />}
        >
          <Input
            aria-invalid={invalid || undefined}
            aria-label="Key"
            autoComplete="off"
            className={cn("font-mono", className)}
            onBlur={() => setOpen(false)}
            onChange={(event) => {
              onChange(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={guardKeys}
            onPaste={onPaste}
            placeholder={placeholder}
            spellCheck={false}
            value={value}
          />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-96 p-1"
          finalFocus={false}
          initialFocus={false}
          onMouseDown={(event) => event.preventDefault()}
        >
          <CommandList>
            <CommandGroup>
              {matches.map((known) => (
                <CommandItem
                  key={known.name}
                  onSelect={() => pick(known.name)}
                  value={known.name}
                >
                  <KnownOption known={known} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <p className="border-border border-t px-2 pt-2 pb-1 text-muted-foreground text-xs">
            Not here? Keep typing to add your own.
          </p>
        </PopoverContent>
      </Popover>
    </Command>
  );
}
