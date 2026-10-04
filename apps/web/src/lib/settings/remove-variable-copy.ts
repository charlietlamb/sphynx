import type { EnvironmentVariable } from "@sphynx/schema/domain/environment";
import {
  knownVariable,
  type VariableUse,
} from "@sphynx/schema/domain/known-variables";

const JUDGE_VENDORS: Readonly<Record<string, string>> = {
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
  google: "Google",
  groq: "Groq",
  moonshotai: "Moonshot",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  typesafe: "TypeSafe",
  xai: "xAI",
};

const FINAL = "This cannot be undone.";

const phraseOf = (use: VariableUse) => {
  if (use.kind === "judge") {
    return `${JUDGE_VENDORS[use.id] ?? use.id} judges`;
  }

  if (use.kind === "simulated") {
    return "simulated people";
  }

  return use.kind === "sandbox" ? `${use.label} sandboxes` : use.label;
};

const listed = (items: readonly string[]) =>
  items.length < 2
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

export interface RemoveVariableCopy {
  readonly confirmLabel: string;
  readonly description: string;
  readonly destructive: boolean;
  readonly title: string;
}

export const removeVariableCopy = (
  variable: Pick<EnvironmentVariable, "name" | "scope">,
  all: readonly Pick<EnvironmentVariable, "name" | "scope">[]
): RemoveVariableCopy => {
  const { name } = variable;
  const shadowsOrganization =
    variable.scope === "personal" &&
    all.some((other) => other.name === name && other.scope === "organization");

  if (shadowsOrganization) {
    return {
      confirmLabel: "Use the organization value",
      description:
        "Your runs go back to the organization value. Nothing stops.",
      destructive: false,
      title: `Remove your ${name}?`,
    };
  }

  const known = knownVariable(name);
  const phrases = [...new Set(known?.uses.map(phraseOf) ?? [])];

  return {
    confirmLabel: `Remove ${name}`,
    description:
      phrases.length === 0
        ? `Suites that name it stop getting it. ${FINAL}`
        : `${listed(phrases)} stop running until you add it again. ${FINAL}`,
    destructive: true,
    title: `Remove ${name}?`,
  };
};
