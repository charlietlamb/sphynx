import { IdGenerator } from "@sphynx/ids/id";
import type { Actor } from "@sphynx/schema/domain/actor";
import type {
  AddVariables,
  EnvironmentVariable,
  UpdateVariable,
} from "@sphynx/schema/domain/environment";
import { Clock, Context, Effect, Layer, Redacted } from "effect";
import { CredentialCipher } from "../credentials/cipher";
import { CredentialError } from "../credentials/errors";
import { openVariable, sealVariable } from "./variable-payload";
import {
  ownerOf,
  type VariableOwner,
  VariableRepository,
  VariableRepositoryLive,
} from "./variable-repository";
import { previewOf, summaryOfVariable, type VariableRow } from "./variable-row";

export interface EnvironmentVariablesShape {
  readonly add: (
    actor: Actor,
    input: AddVariables
  ) => Effect.Effect<readonly EnvironmentVariable[], CredentialError>;
  readonly list: (
    actor: Actor
  ) => Effect.Effect<readonly EnvironmentVariable[], CredentialError>;
  readonly remove: (
    actor: Actor,
    id: string
  ) => Effect.Effect<void, CredentialError>;
  readonly update: (
    actor: Actor,
    id: string,
    change: UpdateVariable
  ) => Effect.Effect<EnvironmentVariable, CredentialError>;
}

export class EnvironmentVariables extends Context.Tag(
  "@sphynx/eval/EnvironmentVariables"
)<EnvironmentVariables, EnvironmentVariablesShape>() {}

const personalNeedsAPerson = (actor: Actor, scope: string) =>
  scope === "personal" && !actor.isUser
    ? Effect.fail(
        new CredentialError({
          message: "API keys cannot own personal variables",
        })
      )
    : Effect.void;

const repeatedName = (names: readonly string[]) =>
  names.find((name, index) => names.indexOf(name) !== index);

export const EnvironmentVariablesLive = Layer.effect(
  EnvironmentVariables,
  Effect.gen(function* () {
    const cipher = yield* CredentialCipher;
    const ids = yield* IdGenerator;
    const repository = yield* VariableRepository;

    const now = Clock.currentTimeMillis.pipe(Effect.map((ms) => new Date(ms)));

    const add = (actor: Actor, input: AddVariables) =>
      Effect.gen(function* () {
        yield* personalNeedsAPerson(actor, input.scope);
        const repeated = repeatedName(input.variables.map(({ name }) => name));
        if (repeated !== undefined) {
          return yield* new CredentialError({
            message: `${repeated} is listed twice`,
          });
        }

        const owner = ownerOf(actor);
        const at = yield* now;
        const existing = (yield* repository.named(
          owner,
          input.variables.map(({ name }) => name)
        )).filter((row) => row.scope === input.scope);

        const replacements = yield* Effect.forEach(
          input.variables.flatMap((variable) => {
            const row = existing.find(({ name }) => name === variable.name);
            return row === undefined ? [] : [{ row, variable }];
          }),
          ({ row, variable }) =>
            sealVariable(cipher, variable.value, row).pipe(
              Effect.map((sealedValue) => ({
                change: {
                  preview: previewOf(variable.value, variable.secret),
                  sealedValue,
                  secret: variable.secret,
                },
                id: row.id,
              }))
            )
        );

        const inserts = yield* Effect.forEach(
          input.variables.filter(
            (variable) => !existing.some(({ name }) => name === variable.name)
          ),
          (variable) =>
            Effect.gen(function* () {
              const id = yield* ids.generate("environmentVariable");
              const sealedValue = yield* sealVariable(cipher, variable.value, {
                id,
                name: variable.name,
                organizationId: actor.organizationId,
              });
              return {
                createdAt: at,
                createdBy: actor.isUser ? actor.id : null,
                id,
                name: variable.name,
                organizationId: actor.organizationId,
                ownerUserId: input.scope === "personal" ? actor.id : null,
                preview: previewOf(variable.value, variable.secret),
                scope: input.scope,
                sealedValue,
                secret: variable.secret,
                updatedAt: at,
              };
            })
        );
        const saved = yield* repository.save(
          owner,
          { inserts, replacements },
          at
        );
        return saved.map(summaryOfVariable);
      }).pipe(
        Effect.withSpan("EnvironmentVariables.add"),
        Effect.annotateLogs({ organizationId: actor.organizationId })
      );

    const scopeFree = (
      owner: VariableOwner,
      row: VariableRow,
      change: UpdateVariable
    ) =>
      Effect.gen(function* () {
        const scope = change.scope;
        if (scope === undefined || scope === row.scope) {
          return;
        }
        const taken = (yield* repository.named(owner, [row.name])).some(
          (other) => other.scope === scope
        );
        if (taken) {
          return yield* new CredentialError({
            message: `${row.name} is already set for ${scope === "personal" ? "you" : "the organization"}`,
          });
        }
      });

    const shownAs = (row: VariableRow, change: UpdateVariable) =>
      Effect.gen(function* () {
        const secret = change.secret ?? row.secret;
        if (row.secret && !secret && change.value === undefined) {
          return yield* new CredentialError({
            message: "Give a new value to make a secret readable",
          });
        }
        if (change.value !== undefined) {
          return { preview: previewOf(change.value, secret), secret };
        }
        if (secret === row.secret) {
          return {};
        }
        const value = Redacted.value(yield* openVariable(cipher, row));
        return { preview: previewOf(value, secret), secret };
      });

    const update = (actor: Actor, id: string, change: UpdateVariable) =>
      Effect.gen(function* () {
        if (change.scope !== undefined) {
          yield* personalNeedsAPerson(actor, change.scope);
        }
        const owner = ownerOf(actor);
        const row = yield* repository.find(owner, id);
        yield* scopeFree(owner, row, change);
        const shown = yield* shownAs(row, change);
        const sealedValue =
          change.value === undefined
            ? undefined
            : yield* sealVariable(cipher, change.value, row);
        const updated = yield* repository.update(
          owner,
          row.id,
          {
            ...(change.scope === undefined ? {} : { scope: change.scope }),
            ...shown,
            ...(sealedValue === undefined ? {} : { sealedValue }),
          },
          yield* now
        );
        return summaryOfVariable(updated);
      }).pipe(
        Effect.withSpan("EnvironmentVariables.update"),
        Effect.annotateLogs({ organizationId: actor.organizationId })
      );

    return EnvironmentVariables.of({
      add,
      list: (actor) =>
        repository.list(ownerOf(actor)).pipe(
          Effect.map((rows) => rows.map(summaryOfVariable)),
          Effect.withSpan("EnvironmentVariables.list")
        ),
      remove: (actor, id) =>
        repository
          .remove(ownerOf(actor), id)
          .pipe(Effect.withSpan("EnvironmentVariables.remove")),
      update,
    });
  })
).pipe(Layer.provide(VariableRepositoryLive));
