import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@sphynx/ui/components/ui/tooltip";
import type { ReactNode } from "react";

interface SignalTipProps {
  children: ReactNode;
  className?: string;
  label: ReactNode;
}

export function SignalTip({ children, className, label }: SignalTipProps) {
  return (
    <Tooltip>
      <TooltipTrigger className={className} render={<span />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
