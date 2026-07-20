import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useCopy } from "@sphynx/ui/hooks/use-copy";

export function CopyPathButton({ path }: { path: string }) {
  const { copied, copy } = useCopy();
  return (
    <button
      aria-label="Copy file path"
      className="flex size-5 cursor-pointer items-center justify-center rounded-[4px] text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
      onClick={(event) => {
        event.stopPropagation();
        copy(path);
      }}
      title="Copy file path"
      type="button"
    >
      {copied ? (
        <CheckIcon className="size-3 text-addition" weight="bold" />
      ) : (
        <CopyIcon className="size-3" />
      )}
    </button>
  );
}
