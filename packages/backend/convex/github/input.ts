import { ConvexError } from "convex/values";
import type { PullRequestRef } from "./refs";

const SLUG = /^[A-Za-z0-9_.-]+$/;
const SHA = /^[0-9a-f]{40,64}$/i;

function invalid(message: string): never {
  throw new ConvexError({ code: "INVALID_ARGUMENT", message });
}

export function validateRef(ref: PullRequestRef) {
  if (
    !SLUG.test(ref.owner) ||
    ref.owner.length > 100 ||
    !SLUG.test(ref.repo) ||
    ref.repo.length > 100 ||
    !Number.isInteger(ref.number) ||
    ref.number < 1
  ) {
    invalid("Invalid GitHub pull request reference");
  }
}

export function validateText(
  name: string,
  value: string,
  max: number,
  allowEmpty = false
) {
  if (
    value.length > max ||
    (!allowEmpty && value.trim().length === 0) ||
    value.includes("\0")
  ) {
    invalid(
      `${name} must be ${allowEmpty ? "at most" : "between 1 and"} ${max} characters`
    );
  }
}

export function validateSha(sha: string) {
  if (!SHA.test(sha)) {
    invalid("Invalid commit SHA");
  }
}

export function validateLineRange(line: number, startLine: number | null) {
  if (
    !Number.isInteger(line) ||
    line < 1 ||
    (startLine !== null &&
      (!Number.isInteger(startLine) || startLine < 1 || startLine > line))
  ) {
    invalid("Invalid review line range");
  }
}
