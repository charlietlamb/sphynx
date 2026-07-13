"use client";

import { FieldInfo } from "@sphynx/ui/components/form/field-info";
import { Label } from "@sphynx/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sphynx/ui/components/ui/select";
import { useFieldContext } from "@sphynx/ui/hooks/form-context";

interface SelectOption {
  label: string;
  value: string;
}

interface SelectFieldProps {
  label: string;
  options: SelectOption[];
  placeholder?: string;
}

export function SelectField({ label, options, placeholder }: SelectFieldProps) {
  const field = useFieldContext<string>();

  return (
    <div className="grid gap-2">
      <Label htmlFor={field.name}>{label}</Label>
      <Select
        items={options}
        onValueChange={(value) => field.handleChange(value ?? "")}
        value={field.state.value}
      >
        <SelectTrigger className="h-10" id={field.name}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldInfo field={field} />
    </div>
  );
}
