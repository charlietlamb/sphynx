import type { Subscription } from "@sphynx/schema/domain/credentials";
import type { EnvironmentVariable } from "@sphynx/schema/domain/environment";
import {
  knownVariable,
  type VariableUse,
} from "@sphynx/schema/domain/known-variables";
import { PLAN_ORDER, PLANS } from "@/lib/settings/subscription-plans";

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

type HeldSubscription = Pick<Subscription, "isDefault" | "plan" | "status">;

type Impact = "hosted" | "optional" | "stops";

const SENTENCES: Readonly<
  Record<Impact, { readonly one: string; readonly many: string }>
> = {
  hosted: {
    many: "move to Sphynx's hosted account.",
    one: "moves to Sphynx's hosted account.",
  },
  optional: {
    many: "keep running without it.",
    one: "keeps running without it.",
  },
  stops: {
    many: "stop running until you add it again.",
    one: "stops running until you add it again.",
  },
};

const IMPACT_ORDER: readonly Impact[] = ["stops", "hosted", "optional"];

interface Subject {
  readonly name: string;
  readonly plural: boolean;
}

const subjectOf = (use: VariableUse): Subject => {
  if (use.kind === "judge") {
    return { name: `${JUDGE_VENDORS[use.id] ?? use.id} judges`, plural: true };
  }

  if (use.kind === "simulated") {
    return { name: "simulated people", plural: true };
  }

  return use.kind === "sandbox"
    ? { name: `${use.label} sandboxes`, plural: true }
    : { name: use.label, plural: false };
};

const listed = (items: readonly string[]) =>
  items.length < 2
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

const sentence = (impact: Impact, subjects: readonly Subject[]) => {
  const names = [...new Set(subjects.map(({ name }) => name))];
  const many = names.length > 1 || subjects.some(({ plural }) => plural);

  return `${listed(names)} ${many ? SENTENCES[impact].many : SENTENCES[impact].one}`;
};

const planFor = (
  use: VariableUse,
  subscriptions: readonly HeldSubscription[]
) =>
  use.kind === "harness"
    ? PLAN_ORDER.find(
        (plan) =>
          PLANS[plan].harness === use.id &&
          subscriptions.some(
            (held) =>
              held.plan === plan && held.isDefault && held.status === "active"
          )
      )
    : undefined;

const impactOf = (use: VariableUse, optional: boolean): Impact => {
  if (optional) {
    return "optional";
  }

  return use.kind === "sandbox" ? "hosted" : "stops";
};

const consequences = (
  name: string,
  subscriptions: readonly HeldSubscription[]
) => {
  const known = knownVariable(name);

  if (known === undefined) {
    return "Profiles that name it stop running until you add it again.";
  }

  const kept = known.uses.flatMap((use) => {
    const plan = known.optional ? undefined : planFor(use, subscriptions);

    return plan === undefined
      ? []
      : [
          {
            line: `${use.label} keeps running on your ${PLANS[plan].label} plan.`,
            use,
          },
        ];
  });
  const affected = known.uses.filter(
    (use) => !kept.some((held) => held.use === use)
  );

  return [
    ...IMPACT_ORDER.flatMap((impact) => {
      const subjects = affected
        .filter((use) => impactOf(use, known.optional) === impact)
        .map(subjectOf);

      return subjects.length === 0 ? [] : [sentence(impact, subjects)];
    }),
    ...kept.map(({ line }) => line),
  ].join(" ");
};

export interface RemoveVariableCopy {
  readonly confirmLabel: string;
  readonly description: string;
  readonly destructive: boolean;
  readonly title: string;
}

export const removeVariableCopy = (
  variable: Pick<EnvironmentVariable, "name" | "scope">,
  all: readonly Pick<EnvironmentVariable, "name" | "scope">[],
  subscriptions: readonly HeldSubscription[]
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

  return {
    confirmLabel: `Remove ${name}`,
    description: `${consequences(name, subscriptions)} ${FINAL}`,
    destructive: true,
    title: `Remove ${name}?`,
  };
};
