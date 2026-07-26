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
      <SignalTip label={arranging ? "Done arranging" : "Rearrange panes"}>
        <Toggle
          aria-label="Toggle arrange mode"
          className="gap-1.5 px-2 font-medium text-muted-foreground text-xs aria-pressed:border-primary/30 aria-pressed:bg-primary/10 aria-pressed:text-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
          onPressedChange={onToggle}
          pressed={arranging}
          size="sm"
          variant="outline"
        >
          <ArrowsOutCardinalIcon weight={arranging ? "fill" : "regular"} />
          Arrange
        </Toggle>
      </SignalTip>
      {arranging ? (
        <SignalTip label="Reset to default layout">
          <Button
            aria-label="Reset layout"
            className="h-6 gap-1.5 px-2 text-muted-foreground text-xs"
            onClick={onReset}
            size="sm"
            type="button"
            variant="ghost"
          >
            <ArrowCounterClockwiseIcon className="size-3.5" />
            Reset
          </Button>
        </SignalTip>
      ) : null}
    </div>
  );
}
