import { ShortcutButton } from "@sphynx/ui/components/shortcut-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@sphynx/ui/components/ui/dialog";
import type { ReactNode } from "react";

interface ConfirmActionDialogProps {
  children?: ReactNode;
  confirmDisabled?: boolean;
  confirmLabel: string;
  description: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}

export function ConfirmActionDialog({
  children,
  confirmDisabled = false,
  confirmLabel,
  description,
  onConfirm,
  onOpenChange,
  open,
  title,
}: ConfirmActionDialogProps) {
  const confirmOnMetaEnter = (event: React.KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      onConfirm();
    }
  };
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent onKeyDown={confirmOnMetaEnter} showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <ShortcutButton
          className="w-full"
          disabled={confirmDisabled}
          onClick={onConfirm}
          shortcut={["⌘", "↵"]}
          size="sm"
        >
          {confirmLabel}
        </ShortcutButton>
      </DialogContent>
    </Dialog>
  );
}
