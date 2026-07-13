import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@sphynx/ui/components/ui/alert-dialog";
import { buttonVariants } from "@sphynx/ui/components/ui/button";
import { Kbd } from "@sphynx/ui/components/ui/kbd";
import { isMac, useShortcut } from "@sphynx/ui/hooks/use-shortcut";
import { cn } from "@sphynx/ui/lib/utils";
import { useState } from "react";

export interface ConfirmDialogProps {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  destructive?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  open: boolean;
  title: string;
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setPending(false);
    }
  }

  useShortcut("enter", {
    meta: true,
    disabled: !open || pending,
    onTrigger: handleConfirm,
  });

  return (
    <AlertDialog onOpenChange={(next) => (next ? null : onClose())} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              "gap-1.5",
              destructive && buttonVariants({ variant: "destructive" })
            )}
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              handleConfirm();
            }}
          >
            {pending ? "Working…" : confirmLabel}
            {pending ? null : (
              <span className="flex items-center gap-0.5">
                <Kbd>{isMac() ? "⌘" : "Ctrl"}</Kbd>
                <Kbd>↵</Kbd>
              </span>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
