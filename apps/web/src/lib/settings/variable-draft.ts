import type { EnvEntry } from "@sphynx/schema/domain/env-file";
import {
  RESERVED_VARIABLE_PREFIX,
  VARIABLE_LIMITS,
  VariableName,
} from "@sphynx/schema/domain/environment";
import { Schema } from "effect";

export interface DraftRow {
  readonly id: string;
  readonly name: string;
  readonly value: string;
}

export interface RowProblem {
  readonly field: "name" | "value";
  readonly message: string;
  readonly tone: "error" | "warning";
}

export interface ExistingVariable {
  readonly name: string;
  readonly preview: string;
  readonly scope: string;
}

const isVariableName = Schema.is(VariableName);

export const looksLikeEnv = (text: string) =>
  text.includes("\n") || text.includes("=");

export const draftRow = (entry: Partial<EnvEntry> = {}): DraftRow => ({
  id: crypto.randomUUID(),
  name: entry.name ?? "",
  value: entry.value ?? "",
});

const isBlank = (row: DraftRow) => row.name === "" && row.value === "";

export const withTrailingRow = (rows: readonly DraftRow[]) => {
  const last = rows.at(-1);

  return last !== undefined && isBlank(last) ? rows : [...rows, draftRow()];
};

export const pasteInto = (
  rows: readonly DraftRow[],
  index: number,
  entries: readonly EnvEntry[]
) =>
  withTrailingRow([
    ...rows.slice(0, index),
    ...entries.map(draftRow),
    ...rows.slice(index + 1),
  ]);

const nameProblem = (name: string): string | null => {
  if (name.startsWith(RESERVED_VARIABLE_PREFIX)) {
    return `Names starting with ${RESERVED_VARIABLE_PREFIX} are reserved. Rename it or remove the row.`;
  }

  return isVariableName(name)
    ? null
    : "Use capital letters, digits and underscores";
};

export const rowProblem = (
  rows: readonly DraftRow[],
  index: number,
  existing: readonly ExistingVariable[],
  scope: string
): RowProblem | null => {
  const name = rows[index]?.name.trim() ?? "";
  const value = rows[index]?.value ?? "";

  if (value.length > VARIABLE_LIMITS.valueChars) {
    return {
      field: "value",
      message: `Values hold at most ${VARIABLE_LIMITS.valueChars.toLocaleString("en-US")} characters`,
      tone: "error",
    };
  }

  if (name === "") {
    return null;
  }

  const invalid = nameProblem(name);

  if (invalid !== null) {
    return { field: "name", message: invalid, tone: "error" };
  }

  if (rows.slice(0, index).some((row) => row.name.trim() === name)) {
    return {
      field: "name",
      message: "This name is already in the list",
      tone: "error",
    };
  }

  const replaced = existing.find(
    (variable) => variable.name === name && variable.scope === scope
  );

  return replaced === undefined
    ? null
    : {
        field: "value",
        message: `Replaces ${replaced.preview} on save`,
        tone: "warning",
      };
};

export const completeRows = (rows: readonly DraftRow[]) =>
  rows
    .map((row) => ({ name: row.name.trim(), value: row.value }))
    .filter((row) => row.name !== "" && row.value !== "");

export const tooMany = (complete: readonly unknown[]) => {
  const over = complete.length - VARIABLE_LIMITS.perRequest;

  return over > 0
    ? `Add up to ${VARIABLE_LIMITS.perRequest} at a time. Remove ${over} to continue.`
    : null;
};
