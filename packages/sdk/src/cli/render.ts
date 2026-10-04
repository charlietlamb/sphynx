import type { PublicPrompt } from "@sphynx/schema/public/shapes";
import { Console, Effect } from "effect";

export const json = (value: unknown) =>
  Console.log(JSON.stringify(value, null, 2));

export const promptContent = (prompt: PublicPrompt) =>
  Effect.sync(() => {
    process.stdout.write(prompt.content);
    if (!prompt.content.endsWith("\n")) {
      process.stdout.write("\n");
    }
  });

/* Stdout, not stderr: a result the caller may pipe into another tool. */
export const row = (line: string) =>
  Effect.sync(() => {
    process.stdout.write(`${line}\n`);
  });

export const note = (message: string) =>
  Effect.sync(() => {
    process.stderr.write(`${message}\n`);
  });

export const stdinIsTerminal = Effect.sync(
  () => globalThis.process?.stdin?.isTTY === true
);

export const attended = Effect.sync(
  () => globalThis.process?.stdout?.isTTY === true
);
