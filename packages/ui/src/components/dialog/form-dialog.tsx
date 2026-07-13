import { BaseDialog } from "@sphynx/ui/components/dialog/base-dialog";
import type { ReactNode } from "react";

interface FormDialogProps {
  children: ReactNode;
  description?: string;
  onClose: () => void;
  onSubmit: () => void;
  open: boolean;
  title: string;
}

export function FormDialog({
  open,
  onClose,
  title,
  description,
  onSubmit,
  children,
}: FormDialogProps) {
  return (
    <BaseDialog
      description={description}
      onClose={onClose}
      open={open}
      title={title}
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {children}
      </form>
    </BaseDialog>
  );
}
