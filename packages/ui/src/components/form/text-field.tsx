"use client";

import { FieldInfo } from "@sphynx/ui/components/form/field-info";
import { Input } from "@sphynx/ui/components/ui/input";
import { Label } from "@sphynx/ui/components/ui/label";
import { useFieldContext } from "@sphynx/ui/hooks/form-context";

interface TextFieldProps {
  autoComplete?: string;
  label: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
}

export function TextField({
  label,
  type = "text",
  placeholder,
  autoComplete,
  onValueChange,
}: TextFieldProps) {
  const field = useFieldContext<string>();

  return (
    <div className="grid gap-2">
      <Label htmlFor={field.name}>{label}</Label>
      <Input
        autoComplete={autoComplete}
        className="h-10 px-3 text-sm md:text-sm"
        id={field.name}
        onBlur={field.handleBlur}
        onChange={(event) => {
          field.handleChange(event.target.value);
          onValueChange?.(event.target.value);
        }}
        placeholder={placeholder}
        type={type}
        value={field.state.value}
      />
      <FieldInfo field={field} />
    </div>
  );
}
