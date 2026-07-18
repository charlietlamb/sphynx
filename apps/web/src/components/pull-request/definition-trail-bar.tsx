import { ArrowUUpLeftIcon, CaretRightIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "@sphynx/ui/components/ui/button";
import { Fragment } from "react";
import {
  type DefinitionRef,
  trailKeyAt,
} from "@/components/pull-request/pull-request-search";
import { baseName } from "@/lib/paths";

const MAX_CRUMBS = 4;

function visibleIndexes(length: number) {
  if (length <= MAX_CRUMBS) {
    return Array.from({ length }, (_, index) => index);
  }
  return [0, length - 2, length - 1];
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
  const indexes = visibleIndexes(trail.length);
  const hidden = trail.length - indexes.length;
  return (
    <div className="flex items-center gap-1.5">
      <nav
        aria-label="Definition trail"
        className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
      >
        {indexes.map((index, order) => {
          const entry = trail[index];
          const isLast = index === trail.length - 1;
          const label = (
            <>
              {baseName(entry.path)}
              <span className="text-muted-foreground/60">:{entry.line}</span>
            </>
          );
          return (
            <Fragment key={trailKeyAt(trail, index)}>
              {order > 0 ? (
                <>
                  {hidden > 0 && order === 1 ? (
                    <>
                      <CaretRightIcon className="size-3 shrink-0 text-muted-foreground/50" />
                      <span
                        className="shrink-0 px-1 text-muted-foreground/60 text-xs"
                        title={`${hidden} more`}
                      >
                        …
                      </span>
                    </>
                  ) : null}
                  <CaretRightIcon className="size-3 shrink-0 text-muted-foreground/50" />
                </>
              ) : null}
              {isLast ? (
                <span
                  aria-current="page"
                  className="flex h-6 shrink-0 items-center gap-1 px-1 font-mono text-foreground text-xs"
                >
                  {label}
                </span>
              ) : (
                <button
                  className="flex h-6 shrink-0 items-center gap-1 px-1 font-mono text-muted-foreground text-xs transition-colors hover:text-foreground"
                  onClick={() => onTruncate(index)}
                  type="button"
                >
                  {label}
                </button>
              )}
            </Fragment>
          );
        })}
      </nav>
      <div className="flex shrink-0 items-center gap-0.5 border-border border-l pl-1.5">
        <Button
          aria-label="Back"
          className="text-muted-foreground"
          onClick={onBack}
          size="icon-xs"
          title="Back · u"
          variant="ghost"
        >
          <ArrowUUpLeftIcon />
        </Button>
        <Button
          aria-label="Close definitions"
          className="text-muted-foreground"
          onClick={onClose}
          size="icon-xs"
          title="Close · Esc"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}
