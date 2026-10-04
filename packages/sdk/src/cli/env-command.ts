import { Args, Command, Options, Prompt } from "@effect/cli";
import { FileSystem } from "@effect/platform";
import { secretByDefault } from "@sphynx/schema/domain/environment";
import { knownVariable } from "@sphynx/schema/domain/known-variables";
import { SphynxApi } from "@sphynx/schema/public/client";
import { Effect, Option, Redacted } from "effect";
import { parseEnvFile } from "./env-file";
import { json, note, row, stdinIsTerminal } from "./render";

const asJson = Options.boolean("json").pipe(
  Options.withDescription("Print the result as JSON")
);

const personal = Options.boolean("personal").pipe(
  Options.withDescription(
    "Only for you, instead of everyone in the organization"
  )
);

const plain = Options.boolean("plain").pipe(
  Options.withDescription("Not a secret, so its value stays readable")
);

const variableName = Args.text({ name: "name" }).pipe(
  Args.withDescription("The variable's name, such as ANTHROPIC_API_KEY")
);

const file = Args.file({ exists: "yes", name: "file" }).pipe(
  Args.withDescription("A .env file to read. Reads stdin when left out"),
  Args.optional
);

const TRAILING_NEWLINE = /\r?\n$/;

const scopeOf = (wantsPersonal: boolean) =>
  wantsPersonal ? ("personal" as const) : ("organization" as const);

const readStdin = Effect.promise(async () => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Uint8Array);
  }
  return Buffer.concat(chunks).toString("utf8");
});

const readValue = (label: string) =>
  Effect.gen(function* () {
    if (yield* stdinIsTerminal) {
      return Redacted.value(yield* Prompt.password({ message: label }));
    }
    return (yield* readStdin).replace(TRAILING_NEWLINE, "");
  });

const usedBy = (name: string) =>
  knownVariable(name)
    ?.uses.map((use) => use.label)
    .filter((label, index, labels) => labels.indexOf(label) === index)
    .join(", ") ?? "your code";

const list = Command.make("list", { asJson }, ({ asJson: wantsJson }) =>
  Effect.gen(function* () {
    const api = yield* SphynxApi;
    const found = yield* api.environment.list({ payload: {} });
    if (wantsJson) {
      return yield* json(found);
    }
    if (found.variables.length === 0 && found.subscriptions.length === 0) {
      return yield* note("Nothing set yet. Add a key with `sphynx env set`.");
    }
    yield* Effect.forEach(found.subscriptions, (subscription) =>
      row(`${subscription.plan}\tsubscription\t${subscription.scope}`)
    );
    return yield* Effect.forEach(found.variables, (variable) =>
      row(
        `${variable.name}\t${variable.preview}\t${usedBy(variable.name)}\t${variable.scope}`
      )
    );
  })
).pipe(Command.withDescription("List variables and subscriptions"));

const set = Command.make(
  "set",
  { personal, plain, variableName },
  ({ personal: wantsPersonal, plain: isPlain, variableName: name }) =>
    Effect.gen(function* () {
      const api = yield* SphynxApi;
      const value = yield* readValue(name);
      if (value === "") {
        return yield* note(`No value given for ${name}.`);
      }
      yield* api.environment.set({
        payload: {
          scope: scopeOf(wantsPersonal),
          variables: [{ name, secret: !isPlain, value }],
        },
      });
      return yield* note(`Set ${name}, used by ${usedBy(name)}`);
    })
).pipe(
  Command.withDescription(
    "Set a variable. The value is prompted for, or read from stdin"
  )
);

const importFile = Command.make(
  "import",
  { file, personal },
  ({ file: path, personal: wantsPersonal }) =>
    Effect.gen(function* () {
      const api = yield* SphynxApi;
      const fs = yield* FileSystem.FileSystem;
      const text = yield* Option.match(path, {
        onNone: () => readStdin,
        onSome: (found) => fs.readFileString(found),
      });
      const entries = parseEnvFile(text);
      if (entries.length === 0) {
        return yield* note("No KEY=value lines found.");
      }
      yield* api.environment.set({
        payload: {
          scope: scopeOf(wantsPersonal),
          variables: entries.map((entry) => ({
            name: entry.name,
            secret: secretByDefault(
              entry.name,
              entry.value,
              knownVariable(entry.name)
            ),
            value: entry.value,
          })),
        },
      });
      return yield* note(
        `Set ${entries.length} ${entries.length === 1 ? "variable" : "variables"}`
      );
    })
).pipe(Command.withDescription("Set every variable in a .env file"));

const remove = Command.make(
  "remove",
  { personal, variableName },
  ({ personal: wantsPersonal, variableName: name }) =>
    Effect.gen(function* () {
      const api = yield* SphynxApi;
      yield* api.environment.remove({
        payload: { name, scope: scopeOf(wantsPersonal) },
      });
      return yield* note(`Removed ${name}`);
    })
).pipe(Command.withDescription("Remove a variable"));

export const env = Command.make("env").pipe(
  Command.withDescription("The keys and subscriptions eval runs use"),
  Command.withSubcommands([importFile, list, remove, set])
);
