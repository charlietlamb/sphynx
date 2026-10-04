import type { EnvFile } from "@sphynx/schema/domain/env-file";
import { useState } from "react";
import {
  type DraftRow,
  draftRow,
  pasteInto,
  withTrailingRow,
} from "@/lib/settings/variable-draft";

interface Pasted {
  readonly before: readonly DraftRow[] | null;
  readonly count: number;
  readonly skipped: readonly string[];
}

export function useVariableDraft() {
  const [rows, setRows] = useState<readonly DraftRow[]>(() => [draftRow()]);
  const [pasted, setPasted] = useState<Pasted | null>(null);

  const settle = () =>
    setPasted((current) =>
      current === null ? null : { ...current, before: null }
    );

  const update = (id: string, patch: Partial<Omit<DraftRow, "id">>) => {
    settle();
    setRows((current) =>
      withTrailingRow(
        current.map((row) => (row.id === id ? { ...row, ...patch } : row))
      )
    );
  };

  const remove = (id: string) => {
    settle();
    setRows((current) =>
      withTrailingRow(current.filter((row) => row.id !== id))
    );
  };

  const paste = (id: string, file: EnvFile) => {
    setPasted({
      before: file.entries.length > 0 ? rows : null,
      count: file.entries.length,
      skipped: file.empty,
    });
    if (file.entries.length > 0) {
      setRows(
        pasteInto(
          rows,
          rows.findIndex((row) => row.id === id),
          file.entries
        )
      );
    }
  };

  const undo = () => {
    if (pasted?.before) {
      setRows(pasted.before);
      setPasted(null);
    }
  };

  return { pasted, paste, remove, rows, undo, update };
}
