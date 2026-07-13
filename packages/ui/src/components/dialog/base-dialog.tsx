import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@sphynx/ui/components/ui/dialog";
import { cn } from "@sphynx/ui/lib/utils";
import type { ReactNode } from "react";

interface BaseDialogProps {
  children: ReactNode;
  className?: string;
  description?: string;
  onClose: () => void;
  open: boolean;
  title: string;
}

export function BaseDialog({
  open,
  onClose,
  title,
  description,
  className,
  children,
}: BaseDialogProps) {
  return (
    <Dialog onOpenChange={(next) => (next ? null : onClose())} open={open}>
      <DialogContent className={cn("sm:max-w-sm", className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
