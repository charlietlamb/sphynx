import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { Button } from "@sphynx/ui/components/ui/button";
import { useEffect, useRef, useState } from "react";

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
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    },
    []
  );

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button
      aria-label={label}
      className={className}
      onClick={onCopy}
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
