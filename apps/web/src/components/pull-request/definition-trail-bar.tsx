import { ArrowUUpLeftIcon, CaretRightIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "@sphynx/ui/components/ui/button";
import { Fragment, type ReactNode } from "react";
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

function TrailSeparator({ hidden }: { hidden: number }) {
  return (
    <>
      {hidden > 0 ? (
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
  );
}

function TrailCrumb({
  children,
  isLast,
  onSelect,
}: {
  children: ReactNode;
  isLast: boolean;
  onSelect: () => void;
}) {
  if (isLast) {
    return (
      <span
        aria-current="page"
        className="flex h-6 shrink-0 items-center gap-1 px-1 font-mono text-foreground text-xs"
      >
        {children}
      </span>
    );
  }
  return (
    <button
      className="flex h-6 shrink-0 items-center gap-1 px-1 font-mono text-muted-foreground text-xs transition-colors hover:text-foreground"
      onClick={onSelect}
      type="button"
    >
      {children}
    </button>
  );
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
          return (
            <Fragment key={trailKeyAt(trail, index)}>
              {order > 0 ? (
                <TrailSeparator hidden={order === 1 ? hidden : 0} />
              ) : null}
              <TrailCrumb
                isLast={index === trail.length - 1}
                onSelect={() => onTruncate(index)}
              >
                {baseName(entry.path)}
                <span className="text-muted-foreground/60">:{entry.line}</span>
              </TrailCrumb>
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
