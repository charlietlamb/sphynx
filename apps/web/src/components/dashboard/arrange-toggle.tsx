import {
  ArrowCounterClockwiseIcon,
  ArrowsOutCardinalIcon,
} from "@phosphor-icons/react";
import { Button } from "@sphynx/ui/components/ui/button";
import { Toggle } from "@sphynx/ui/components/ui/toggle";
import { SignalTip } from "@/components/dashboard/signal-tip";

interface ArrangeToggleProps {
  arranging: boolean;
  onReset: () => void;
  onToggle: () => void;
}

export function ArrangeToggle({
  arranging,
  onReset,
  onToggle,
}: ArrangeToggleProps) {
  return (
    <div className="flex items-center gap-1.5">
      {arranging ? (
        <SignalTip label="Reset to default layout">
          <Button
            aria-label="Reset layout"
            onClick={onReset}
            size="icon"
            type="button"
            variant="outline"
          >
            <ArrowCounterClockwiseIcon className="size-[1.125rem]" />
          </Button>
        </SignalTip>
      ) : null}
      <SignalTip label={arranging ? "Done arranging" : "Rearrange panes"}>
        <Toggle
          aria-label="Toggle arrange mode"
          className="input-bevel-shadow size-[1.875rem] rounded-md border border-border bg-background text-foreground hover:bg-muted aria-pressed:border-primary/40 aria-pressed:bg-primary/10 aria-pressed:text-primary aria-pressed:shadow-none data-[state=on]:bg-primary/10 data-[state=on]:text-primary dark:bg-input/30 dark:aria-pressed:bg-primary/15"
          onPressedChange={onToggle}
          pressed={arranging}
        >
          <ArrowsOutCardinalIcon
            className="size-[1.125rem]"
            weight={arranging ? "fill" : "regular"}
          />
        </Toggle>
      </SignalTip>
    </div>
  );
}
