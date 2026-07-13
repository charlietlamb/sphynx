import type { AnyFieldApi } from "@tanstack/react-form";

export function FieldInfo({ field }: { field: AnyFieldApi }) {
  if (!(field.state.meta.isTouched && field.state.meta.errors.length > 0)) {
    return null;
  }

  return (
    <p className="text-destructive text-xs">
      {field.state.meta.errors[0]?.message}
    </p>
  );
}
