import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { Button } from "@sphynx/ui/components/ui/button";
import { useCopy } from "@sphynx/ui/hooks/use-copy";

interface CopyButtonProps {
  className?: string;
  label?: string;
  value: string;
}

export function CopyButton({
  value,
  className,
  label = "Copy",
}: CopyButtonProps) {
  const { copied, copy } = useCopy(2000);
  return (
    <Button
      aria-label={label}
      className={className}
      onClick={() => copy(value)}
      size="icon-sm"
      type="button"
      variant="ghost"
    >
      {copied ? (
        <CheckIcon className="size-4" />
      ) : (
        <CopyIcon className="size-4" />
      )}
    </Button>
  );
}
