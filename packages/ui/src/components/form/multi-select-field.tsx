"use client";

import { XIcon } from "@phosphor-icons/react";
import { FieldInfo } from "@sphynx/ui/components/form/field-info";
import { Label } from "@sphynx/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@sphynx/ui/components/ui/select";
import { useFieldContext } from "@sphynx/ui/hooks/form-context";

interface MultiSelectOption {
  label: string;
  value: string;
}

interface MultiSelectFieldProps {
  label: string;
  options: MultiSelectOption[];
  placeholder?: string;
}

export function MultiSelectField({
  label,
  options,
  placeholder = "Select…",
}: MultiSelectFieldProps) {
  const field = useFieldContext<string[]>();
  const selected = field.state.value ?? [];

  const labelFor = (value: string) =>
    options.find((option) => option.value === value)?.label ?? value;

  const remove = (value: string) =>
    field.handleChange(selected.filter((item) => item !== value));

  return (
    <div className="grid gap-2">
      <Label htmlFor={field.name}>{label}</Label>
      <Select
        items={options}
        multiple
        onValueChange={(value) => field.handleChange(value as string[])}
        value={selected}
      >
        <SelectTrigger className="h-auto min-h-9 w-full py-1" id={field.name}>
          {selected.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            <div className="flex flex-1 flex-wrap items-center gap-1">
              {selected.map((value) => (
                <span
                  className="inline-flex items-center gap-1 rounded-md bg-muted py-0.5 pr-1 pl-2 text-muted-foreground text-xs"
                  key={value}
                >
                  {labelFor(value)}
                  <button
                    aria-label={`Remove ${labelFor(value)}`}
                    className="rounded-sm text-muted-foreground/70 hover:text-foreground"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      remove(value);
                    }}
                    type="button"
                  >
                    <XIcon className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
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
