import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useCopy } from "@sphynx/ui/hooks/use-copy";

export function BranchChip({ name }: { name: string }) {
  const { copied, copy } = useCopy();
  return (
    <button
      className="flex cursor-pointer items-center gap-1 rounded-[5px] bg-muted/50 px-1 py-px font-mono text-[11px] text-foreground/90 transition-colors hover:bg-muted"
      onClick={() => copy(name)}
      type="button"
    >
      {name}
      {copied ? (
        <CheckIcon className="size-2.5 text-addition" />
      ) : (
        <CopyIcon className="size-2.5 text-muted-foreground/60" />
      )}
    </button>
  );
}
