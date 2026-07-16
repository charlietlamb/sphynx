import { CaretRightIcon } from "@phosphor-icons/react";
import { Button } from "@sphynx/ui/components/ui/button";
import { cn } from "@sphynx/ui/lib/utils";
import { Fragment } from "react";
import {
  type DefinitionRef,
  trailKeyAt,
} from "@/components/pull-request/pull-request-search";

function baseName(path: string) {
  return path.split("/").at(-1) ?? path;
}

interface DefinitionTrailBarProps {
  onBack: () => void;
  onClose: () => void;
  onTruncate: (index: number) => void;
  trail: readonly DefinitionRef[];
}

export function DefinitionTrailBar({
  onBack,
  onClose,
  onTruncate,
  trail,
}: DefinitionTrailBarProps) {
  return (
    <div className="flex items-center gap-1">
      <nav
        aria-label="Definition trail"
        className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
      >
        {trail.map((entry, index) => {
          const isLast = index === trail.length - 1;
          return (
            <Fragment key={trailKeyAt(trail, index)}>
              {index > 0 ? (
                <CaretRightIcon className="size-3 shrink-0 text-muted-foreground/50" />
              ) : null}
              <Button
                className={cn(
                  "h-6 shrink-0 px-1.5 text-muted-foreground text-xs",
                  isLast && "bg-muted text-foreground"
                )}
                disabled={isLast}
                onClick={() => onTruncate(index)}
                size="sm"
                variant="ghost"
              >
                {baseName(entry.path)}
                <span className="text-muted-foreground/60">:{entry.line}</span>
              </Button>
            </Fragment>
          );
        })}
      </nav>
      <Button
        className="h-6 shrink-0 px-1.5 text-xs"
        onClick={onBack}
        size="sm"
        variant="ghost"
      >
        Back
      </Button>
      <Button
        className="h-6 shrink-0 px-1.5 text-xs"
        onClick={onClose}
        size="sm"
        variant="ghost"
      >
        Close
      </Button>
    </div>
  );
}
