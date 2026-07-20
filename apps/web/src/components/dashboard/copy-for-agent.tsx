import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useCopy } from "@sphynx/ui/hooks/use-copy";

export function CopyForAgent({ value }: { value: string }) {
  const { copied, copy } = useCopy(2000);
  return (
    <button
      className="-my-1 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-alpha-4 hover:text-foreground"
      onClick={() => copy(value)}
      type="button"
    >
      {copied ? (
        <CheckIcon className="size-3 text-addition" />
      ) : (
        <CopyIcon className="size-3" />
      )}
      {copied ? "copied" : "copy all for agent"}
    </button>
  );
}
