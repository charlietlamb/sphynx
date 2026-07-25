import { cn } from "@sphynx/ui/lib/utils";
import { SignalTip } from "@/components/dashboard/signal-tip";
import type { CiRollup } from "@/lib/attention";

function dotClass({ failing, running }: CiRollup) {
  if (failing > 0) {
    return "bg-deletion group-hover:shadow-[0_0_7px_1px_var(--deletion)]";
  }
  if (running > 0) {
    return "animate-pulse bg-amber-500 group-hover:shadow-[0_0_7px_1px_var(--color-amber-500)]";
  }
  return "bg-addition group-hover:shadow-[0_0_7px_1px_var(--addition)]";
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
  if (ci.failing + ci.running + ci.passing === 0) {
    return null;
  }
  return (
    <SignalTip
      className="inline-flex size-4 shrink-0 items-center justify-center"
      label={ciLabel(ci)}
    >
      <span
        className={cn(
          "size-[5px] rounded-full transition-shadow group-hover:animate-pulse",
          dotClass(ci)
        )}
      />
    </SignalTip>
  );
}
