import { knownVariable } from "@sphynx/schema/domain/known-variables";

export type UsedBy =
  | { readonly kind: "code"; readonly label: string }
  | {
      readonly id: string;
      readonly kind: "harness" | "judge" | "sandbox" | "simulated";
      readonly label: string;
    };

const YOUR_CODE: UsedBy = { kind: "code", label: "Your code" };

export const keyOf = (use: UsedBy) =>
  use.kind === "judge" || use.kind === "code"
    ? use.kind
    : `${use.kind}:${use.id}`;

export const usedBy = (name: string): readonly UsedBy[] => {
  const known = knownVariable(name);

  if (known === undefined) {
    return [YOUR_CODE];
  }

  const seen = new Set<string>();

  return known.uses.filter((use) => {
    const key = keyOf(use);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};
