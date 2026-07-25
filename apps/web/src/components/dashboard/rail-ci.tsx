import {
  CheckCircleIcon,
  CircleNotchIcon,
  type Icon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { cn } from "@sphynx/ui/lib/utils";
import { SignalTip } from "@/components/dashboard/signal-tip";
import type { CiRollup } from "@/lib/attention";

interface CiDisplay {
  count: number;
  glyph: Icon;
  spin: boolean;
  tone: string;
}

function ciDisplay({ failing, passing, running }: CiRollup): CiDisplay | null {
  if (failing > 0) {
    return {
      count: failing,
      glyph: XCircleIcon,
      spin: false,
      tone: "text-deletion",
    };
  }
  if (running > 0) {
    return {
      count: running,
      glyph: CircleNotchIcon,
      spin: true,
      tone: "text-amber-500",
    };
  }
  if (passing > 0) {
    return {
      count: passing,
      glyph: CheckCircleIcon,
      spin: false,
      tone: "text-addition",
    };
  }
  return null;
}

function ciLabel({ failing, passing, running }: CiRollup) {
  const parts: string[] = [];
  if (failing > 0) {
    parts.push(`${failing} failing ci`);
  }
  if (running > 0) {
    parts.push(`${running} running ci`);
  }
  if (passing > 0) {
    parts.push(`${passing} passing ci`);
  }
  return parts.join(" · ");
}

export function RailCi({ ci }: { ci: CiRollup }) {
  const display = ciDisplay(ci);
  if (!display) {
    return null;
  }
  const Glyph = display.glyph;
  return (
    <SignalTip className="flex shrink-0 items-center gap-1" label={ciLabel(ci)}>
      <Glyph
        className={cn("size-3.5", display.tone, display.spin && "animate-spin")}
        weight="fill"
      />
      <span className="text-[11px] text-muted-foreground/70 tabular-nums">
        {display.count}
      </span>
    </SignalTip>
  );
}
