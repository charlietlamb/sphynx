import { createHash } from "node:crypto";
import { Clock, Effect, Redacted } from "effect";
import type { CredentialCipherShape } from "../credentials/cipher";
import type { CredentialError } from "../credentials/errors";
import { openVariable } from "./variable-payload";
import type {
  VariableOwner,
  VariableRepositoryShape,
} from "./variable-repository";
import type { VariableRow } from "./variable-row";

export interface NamedValue {
  readonly row: VariableRow;
  readonly value: string;
}

const personalFirst = (rows: readonly VariableRow[]) => {
  const chosen = new Map<string, VariableRow>();
  for (const row of rows) {
    const held = chosen.get(row.name);
    if (held === undefined || row.scope === "personal") {
      chosen.set(row.name, row);
    }
  }
  return [...chosen.values()];
};

export const namedValues = (
  repository: VariableRepositoryShape,
  cipher: CredentialCipherShape,
  owner: VariableOwner,
  names: readonly string[]
): Effect.Effect<ReadonlyMap<string, NamedValue>, CredentialError> =>
  Effect.gen(function* () {
    const rows = personalFirst(yield* repository.named(owner, names));
    const opened = yield* Effect.forEach(rows, (row) =>
      openVariable(cipher, row).pipe(
        Effect.map(
          (value) => [row.name, { row, value: Redacted.value(value) }] as const
        )
      )
    );
    const at = new Date(yield* Clock.currentTimeMillis);
    yield* repository
      .touch(
        rows.map(({ id }) => id),
        at
      )
      .pipe(Effect.ignore);
    return new Map(opened);
  }).pipe(Effect.withSpan("Variables.named"));

export const valuesOf = (named: ReadonlyMap<string, NamedValue>) =>
  new Map([...named].map(([name, { value }]) => [name, value]));

const LARGEST_REVISION = 0x7f_ff_ff_ff;

export const revisionOf = (named: ReadonlyMap<string, NamedValue>) => {
  const snapshot = [...named.values()]
    .map(({ row }) => [row.name, row.id, row.revision] as const)
    .toSorted(([left], [right]) => left.localeCompare(right));
  const digest = createHash("sha256").update(JSON.stringify(snapshot)).digest();
  return (digest.readUInt32BE(0) % LARGEST_REVISION) + 1;
};
