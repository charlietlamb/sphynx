export type VariableUse =
  | { readonly kind: "harness"; readonly id: string; readonly label: string }
  | { readonly kind: "judge"; readonly id: string; readonly label: string }
  | { readonly kind: "sandbox"; readonly id: string; readonly label: string }
  | {
      readonly kind: "simulated";
      readonly id: string;
      readonly label: string;
    };

export interface KnownVariable {
  readonly description: string;
  readonly name: string;
  readonly secret: boolean;
  readonly uses: readonly VariableUse[];
}

const harness = (id: string, label: string): VariableUse => ({
  id,
  kind: "harness",
  label,
});
const judge = (id: string): VariableUse => ({
  id,
  kind: "judge",
  label: "Judges",
});
const simulated = (): VariableUse => ({
  id: "people",
  kind: "simulated",
  label: "Simulated people",
});
const judges = (id: string): readonly VariableUse[] => [judge(id), simulated()];
const sandbox = (id: string, label: string): VariableUse => ({
  id,
  kind: "sandbox",
  label,
});

const key = (
  name: string,
  description: string,
  uses: readonly VariableUse[]
): KnownVariable => ({ description, name, secret: true, uses });

const plain = (
  name: string,
  description: string,
  uses: readonly VariableUse[]
): KnownVariable => ({ description, name, secret: false, uses });

export const KNOWN_VARIABLES: readonly KnownVariable[] = [
  key("ANTHROPIC_API_KEY", "Runs Claude Code, scores with Anthropic judges", [
    harness("claude", "Claude Code"),
    ...judges("anthropic"),
  ]),
  key("OPENAI_API_KEY", "Runs Codex by key, scores with OpenAI judges", [
    harness("codex", "Codex"),
    ...judges("openai"),
  ]),
  key("AI_GATEWAY_API_KEY", "Runs FX through Vercel AI Gateway", [
    harness("fx", "FX"),
  ]),
  key("GEMINI_API_KEY", "Runs Gemini CLI, scores with Google judges", [
    harness("gemini", "Gemini CLI"),
    ...judges("google"),
  ]),
  key("CURSOR_API_KEY", "Runs Cursor Agent", [harness("cursor", "Cursor")]),
  key("DASHSCOPE_API_KEY", "Runs Qwen Code", [harness("qwen", "Qwen Code")]),
  plain("QWEN_BASE_URL", "Points Qwen Code at another endpoint", [
    harness("qwen", "Qwen Code"),
  ]),
  key("XAI_API_KEY", "Scores with xAI judges", judges("xai")),
  key("MOONSHOT_API_KEY", "Scores with Moonshot judges", judges("moonshotai")),
  key("DEEPSEEK_API_KEY", "Scores with DeepSeek judges", judges("deepseek")),
  key("GROQ_API_KEY", "Scores with Groq judges", judges("groq")),
  key(
    "OPENROUTER_API_KEY",
    "Scores with OpenRouter judges",
    judges("openrouter")
  ),
  key("TYPESAFE_API_KEY", "Scores with TypeSafe judges", judges("typesafe")),
  key("DAYTONA_API_KEY", "Runs sandboxes on your Daytona account", [
    sandbox("daytona", "Daytona"),
  ]),
  key("E2B_API_KEY", "Runs sandboxes on your E2B account", [
    sandbox("e2b", "E2B"),
  ]),
  key("UPSTASH_BOX_API_KEY", "Runs sandboxes on your Upstash Box account", [
    sandbox("upstash", "Upstash Box"),
  ]),
  key("MODAL_TOKEN_ID", "Runs sandboxes on your Modal account", [
    sandbox("modal", "Modal"),
  ]),
  key("MODAL_TOKEN_SECRET", "Runs sandboxes on your Modal account", [
    sandbox("modal", "Modal"),
  ]),
  key("CLOUDFLARE_API_TOKEN", "Runs sandboxes on your Cloudflare account", [
    sandbox("cloudflare", "Cloudflare"),
  ]),
  plain("CLOUDFLARE_ACCOUNT_ID", "The Cloudflare account sandboxes run in", [
    sandbox("cloudflare", "Cloudflare"),
  ]),
  key("CLOUDFLARE_SANDBOX_API_KEY", "Signs requests to your sandbox bridge", [
    sandbox("cloudflare", "Cloudflare"),
  ]),
  plain("CLOUDFLARE_SANDBOX_URL", "Where your sandbox bridge runs", [
    sandbox("cloudflare", "Cloudflare"),
  ]),
  key("VERCEL_TOKEN", "Runs sandboxes on your Vercel account", [
    sandbox("vercel", "Vercel"),
  ]),
  plain("VERCEL_TEAM_ID", "The Vercel team sandboxes run in", [
    sandbox("vercel", "Vercel"),
  ]),
  plain("VERCEL_PROJECT_ID", "The Vercel project sandboxes run in", [
    sandbox("vercel", "Vercel"),
  ]),
];

const BY_NAME = new Map(KNOWN_VARIABLES.map((known) => [known.name, known]));

export const knownVariable = (name: string): KnownVariable | undefined =>
  BY_NAME.get(name);

export const keptOnServer = (name: string) => {
  const known = knownVariable(name);
  return (
    known !== undefined && !known.uses.some((use) => use.kind === "harness")
  );
};
