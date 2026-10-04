import { Cause } from "effect";
import { describeFailure } from "./errors";

const LIMIT = 240;

const firstLine = (text: string) => {
  const line = text.split("\n").find((each) => each.trim() !== "") ?? "";

  return line.length > LIMIT ? `${line.slice(0, LIMIT).trimEnd()}…` : line;
};

/* `String(cause)` prints the whole stack, so a tagged error's own `reason` is
   read out instead. */
const reasonOf = (held: unknown): string | undefined => {
  if (typeof held === "object" && held !== null && "reason" in held) {
    return firstLine(String(held.reason));
  }

  /* Store failures carry no `reason`, and their message beats the pretty cause. */
  if (held instanceof Error && held.message !== "") {
    return firstLine(held.message);
  }

  return;
};

const causeOf = (held: unknown) => {
  if (!(held instanceof Error) || held.cause === undefined) {
    return;
  }

  const inner = describeFailure(held.cause).trim();

  return inner === "" ? undefined : inner;
};

export const describeError = (held: unknown): string => {
  const outer = reasonOf(held) ?? firstLine(String(held));
  const inner = causeOf(held);

  return firstLine(
    inner === undefined || inner === outer ? outer : `${outer}: ${inner}`
  );
};

export const describeCause = (cause: Cause.Cause<unknown>): string => {
  const error = Cause.failureOption(cause);
  const reason = error._tag === "Some" ? reasonOf(error.value) : undefined;

  return reason ?? firstLine(Cause.pretty(cause));
};
