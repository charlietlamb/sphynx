import { XIcon } from "@phosphor-icons/react";
import { type EnvFile, parseEnvFile } from "@sphynx/schema/domain/env-file";
import { secretByDefault } from "@sphynx/schema/domain/environment";
import { knownVariable } from "@sphynx/schema/domain/known-variables";
import { Button } from "@sphynx/ui/components/button";
import { Input } from "@sphynx/ui/components/input";
import { cn } from "@sphynx/ui/lib/utils";
import type { ClipboardEvent } from "react";
import { UsedByBadges } from "@/components/settings/environment/used-by-badges";
import { VariableKeyInput } from "@/components/settings/environment/variable-key-input";
import {
  type DraftRow,
  looksLikeEnv,
  type RowProblem,
} from "@/lib/settings/variable-draft";
import { usedBy } from "@/lib/settings/variable-uses";

export const DRAFT_GRID =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_11.5rem_1.5rem] items-center gap-2";

const TRAILING = "border-dashed border-border bg-transparent shadow-none";

export function DraftVariableRow({
  onChange,
  onPasteEnv,
  onRemove,
  problem,
  row,
  trailing,
}: {
  readonly onChange: (patch: Partial<Omit<DraftRow, "id">>) => void;
  readonly onPasteEnv: (file: EnvFile) => void;
  readonly onRemove: () => void;
  readonly problem: RowProblem | null;
  readonly row: DraftRow;
  readonly trailing: boolean;
}) {
  const name = row.name.trim();
  const secret = secretByDefault(name, row.value, knownVariable(name));

  const pasteEnv = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text");
    if (!looksLikeEnv(text)) {
      return;
    }

    const file = parseEnvFile(text);

    if (file.entries.length > 0 || file.empty.length > 0) {
      event.preventDefault();
      onPasteEnv(file);
    }
  };

  return (
    <li className="flex flex-col gap-1">
      <div className={DRAFT_GRID}>
        <VariableKeyInput
          className={cn(trailing && TRAILING)}
          invalid={problem?.field === "name"}
          onChange={(value) => onChange({ name: value })}
          onPaste={pasteEnv}
          placeholder={trailing ? "KEY or paste .env" : "KEY"}
          value={row.name}
        />
        <Input
          aria-label={name === "" ? "Value" : `Value for ${name}`}
          autoComplete="off"
          className={cn(
            "font-mono",
            trailing && TRAILING,
            problem?.tone === "warning" && "border-warning"
          )}
          onChange={(event) => onChange({ value: event.target.value })}
          placeholder="Value"
          spellCheck={false}
          type={secret ? "password" : "text"}
          value={row.value}
        />
        {name === "" ? <span /> : <UsedByBadges uses={usedBy(name)} />}
        {trailing ? (
          <span />
        ) : (
          <Button
            aria-label={name === "" ? "Remove row" : `Remove ${name}`}
            onClick={onRemove}
            size="icon-xs"
            type="button"
            variant="bare"
          >
            <XIcon />
          </Button>
        )}
      </div>
      {problem === null ? null : (
        <p
          className={cn(
            "text-xs",
            problem.tone === "error" ? "text-destructive" : "text-warning"
          )}
        >
          {problem.message}
        </p>
      )}
    </li>
  );
}
