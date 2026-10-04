import {
  type EnvironmentVariable,
  secretByDefault,
} from "@sphynx/schema/domain/environment";
import { knownVariable } from "@sphynx/schema/domain/known-variables";
import { BaseDialog } from "@sphynx/ui/components/dialog/base-dialog";
import { LabelledSelect } from "@sphynx/ui/components/form/labelled-select";
import { ShortcutButton } from "@sphynx/ui/components/ui/shortcut-button";
import { useState } from "react";
import { toast } from "sonner";
import {
  DRAFT_GRID,
  DraftVariableRow,
} from "@/components/settings/environment/draft-variable-row";
import { PasteBanner } from "@/components/settings/environment/paste-banner";
import { useDialog, useDialogOpen } from "@/lib/dialog/dialogs";
import { environmentClient } from "@/lib/environment-client";
import { SCOPE_OPTIONS, scopeOf } from "@/lib/settings/scopes";
import { useEnvironmentMutation } from "@/lib/settings/use-environment-mutation";
import { useVariableDraft } from "@/lib/settings/use-variable-draft";
import {
  completeRows,
  rowProblem,
  tooMany,
} from "@/lib/settings/variable-draft";

interface AddVariablesDialogProps {
  readonly existing: readonly EnvironmentVariable[];
}

const counted = (count: number) =>
  `${count} ${count === 1 ? "variable" : "variables"}`;

export function AddVariablesDialog({ existing }: AddVariablesDialogProps) {
  const { close } = useDialog();
  const open = useDialogOpen("addVariables");
  const draft = useVariableDraft();
  const [scope, setScope] = useState<string>("organization");
  const add = useEnvironmentMutation({
    failure: "Couldn't add the variables",
    mutationFn: environmentClient.addVariables,
  });

  const problems = draft.rows.map((_, index) =>
    rowProblem(draft.rows, index, existing, scope)
  );
  const complete = completeRows(draft.rows);
  const overLimit = tooMany(complete);
  const blocked =
    overLimit !== null || problems.some((problem) => problem?.tone === "error");
  const disabled = blocked || complete.length === 0 || add.isPending;

  const submit = () => {
    if (disabled) {
      return;
    }

    add.mutate(
      {
        scope: scopeOf(scope),
        variables: complete.map((row) => ({
          ...row,
          secret: secretByDefault(row.name, row.value, knownVariable(row.name)),
        })),
      },
      {
        onSuccess: () => {
          toast.success(`Added ${counted(complete.length)}`);
          close();
        },
      }
    );
  };

  return (
    <BaseDialog
      className="sm:max-w-[640px]"
      description="Add them one by one, or paste a .env into any key."
      onClose={close}
      open={open}
      title="Add variables"
    >
      <div className="flex flex-col gap-2">
        {draft.pasted === null ? null : (
          <PasteBanner
            count={draft.pasted.count}
            onUndo={draft.pasted.before === null ? null : draft.undo}
            skipped={draft.pasted.skipped}
          />
        )}
        <div
          aria-hidden="true"
          className={`${DRAFT_GRID} text-muted-foreground text-xs`}
        >
          <span>Key</span>
          <span>Value</span>
          <span>Used by</span>
        </div>
        <ul className="-m-1 flex max-h-[50vh] flex-col gap-2 overflow-y-auto p-1">
          {draft.rows.map((row, index) => (
            <DraftVariableRow
              key={row.id}
              onChange={(patch) => draft.update(row.id, patch)}
              onPasteEnv={(file) => draft.paste(row.id, file)}
              onRemove={() => draft.remove(row.id)}
              problem={problems[index] ?? null}
              row={row}
              trailing={index === draft.rows.length - 1}
            />
          ))}
        </ul>
      </div>
      {overLimit === null ? null : (
        <p className="text-destructive text-xs" role="alert">
          {overLimit}
        </p>
      )}
      <div className="flex items-end justify-between gap-3">
        <LabelledSelect
          className="w-60"
          id="variables-scope"
          label="Available to"
          onChange={setScope}
          options={SCOPE_OPTIONS}
          value={scope}
        />
        <ShortcutButton
          disabled={disabled}
          metaShortcut="enter"
          onClick={submit}
          type="button"
        >
          {add.isPending
            ? "Adding…"
            : `Add ${counted(Math.max(complete.length, 1))}`}
        </ShortcutButton>
      </div>
    </BaseDialog>
  );
}
