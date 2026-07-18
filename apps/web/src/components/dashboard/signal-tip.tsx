import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@sphynx/ui/components/ui/tooltip";
import type { ReactNode } from "react";

interface SignalTipProps {
  children: ReactNode;
  className?: string;
  label: string;
}

export function SignalTip({ children, className, label }: SignalTipProps) {
  return (
    <TooltipProvider delay={300}>
      <Tooltip>
        <TooltipTrigger className={className} render={<span />}>
          {children}
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
