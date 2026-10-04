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

const withCause = (held: unknown) => {
  const outer = reasonOf(held);
  const inner = firstLine(describeFailure(held));

  return outer === undefined || outer === inner ? inner : `${outer}: ${inner}`;
};

export const describeError = (held: unknown): string =>
  held instanceof Error
    ? withCause(held)
    : (reasonOf(held) ?? firstLine(String(held)));

export const describeCause = (cause: Cause.Cause<unknown>): string => {
  const error = Cause.failureOption(cause);
  const reason = error._tag === "Some" ? reasonOf(error.value) : undefined;

  return reason ?? firstLine(Cause.pretty(cause));
};
