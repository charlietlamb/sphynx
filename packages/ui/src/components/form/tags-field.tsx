"use client";

import { XIcon } from "@phosphor-icons/react";
import { FieldInfo } from "@sphynx/ui/components/form/field-info";
import { Label } from "@sphynx/ui/components/ui/label";
import { useFieldContext } from "@sphynx/ui/hooks/form-context";
import { cn } from "@sphynx/ui/lib/utils";
import { type KeyboardEvent, useState } from "react";

interface TagsFieldProps {
  label: string;
  placeholder?: string;
}

const ADD_KEYS = new Set(["Enter", ",", " "]);

export function TagsField({ label, placeholder = "Add…" }: TagsFieldProps) {
  const field = useFieldContext<string[]>();
  const tags = field.state.value ?? [];
  const [draft, setDraft] = useState("");

  const commit = (value: string) => {
    const next = value.trim();
    if (next && !tags.includes(next)) {
      field.handleChange([...tags, next]);
    }
    setDraft("");
  };

  const remove = (value: string) =>
    field.handleChange(tags.filter((tag) => tag !== value));

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (ADD_KEYS.has(event.key)) {
      event.preventDefault();
      commit(draft);
      return;
    }
    const last = tags.at(-1);
    if (event.key === "Backspace" && draft === "" && last !== undefined) {
      remove(last);
    }
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor={field.name}>{label}</Label>
      <div
        className={cn(
          "flex min-h-9 flex-wrap items-center gap-1 rounded-lg border border-border bg-background px-2 py-1",
          "focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/20"
        )}
      >
        {tags.map((tag) => (
          <span
            className="inline-flex items-center gap-1 rounded-md bg-muted py-0.5 pr-1 pl-2 text-muted-foreground text-xs"
            key={tag}
          >
            {tag}
            <button
              aria-label={`Remove ${tag}`}
              className="rounded-sm text-muted-foreground/70 hover:text-foreground"
              onClick={() => remove(tag)}
              type="button"
            >
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
        <input
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          id={field.name}
          onBlur={() => commit(draft)}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={tags.length === 0 ? placeholder : ""}
          spellCheck={false}
          value={draft}
        />
      </div>
      <FieldInfo field={field} />
    </div>
  );
}
