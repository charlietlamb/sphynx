interface CredentialField {
  readonly field: string;
  readonly optional?: boolean;
  readonly variable: string;
}

export interface VariableCredential {
  readonly authMethodId: string;
  readonly fields: readonly CredentialField[];
}

const apiKey = (variable: string): VariableCredential => ({
  authMethodId: "api-key",
  fields: [{ field: "apiKey", variable }],
});

export const VARIABLE_CREDENTIALS: Readonly<
  Record<string, VariableCredential>
> = {
  anthropic: apiKey("ANTHROPIC_API_KEY"),
  claude: apiKey("ANTHROPIC_API_KEY"),
  cloudflare: {
    authMethodId: "api-token",
    fields: [
      { field: "apiToken", variable: "CLOUDFLARE_API_TOKEN" },
      { field: "accountId", optional: true, variable: "CLOUDFLARE_ACCOUNT_ID" },
      {
        field: "sandboxApiKey",
        optional: true,
        variable: "CLOUDFLARE_SANDBOX_API_KEY",
      },
      {
        field: "sandboxUrl",
        optional: true,
        variable: "CLOUDFLARE_SANDBOX_URL",
      },
    ],
  },
  codex: apiKey("OPENAI_API_KEY"),
  cursor: apiKey("CURSOR_API_KEY"),
  daytona: apiKey("DAYTONA_API_KEY"),
  deepseek: apiKey("DEEPSEEK_API_KEY"),
  e2b: apiKey("E2B_API_KEY"),
  fx: apiKey("AI_GATEWAY_API_KEY"),
  gemini: apiKey("GEMINI_API_KEY"),
  google: apiKey("GEMINI_API_KEY"),
  groq: apiKey("GROQ_API_KEY"),
  modal: {
    authMethodId: "token",
    fields: [
      { field: "tokenId", variable: "MODAL_TOKEN_ID" },
      { field: "tokenSecret", variable: "MODAL_TOKEN_SECRET" },
    ],
  },
  moonshotai: apiKey("MOONSHOT_API_KEY"),
  openai: apiKey("OPENAI_API_KEY"),
  openrouter: apiKey("OPENROUTER_API_KEY"),
  qwen: {
    authMethodId: "api-key",
    fields: [
      { field: "apiKey", variable: "DASHSCOPE_API_KEY" },
      { field: "baseUrl", optional: true, variable: "QWEN_BASE_URL" },
    ],
  },
  typesafe: apiKey("TYPESAFE_API_KEY"),
  upstash: apiKey("UPSTASH_BOX_API_KEY"),
  vercel: {
    authMethodId: "token",
    fields: [
      { field: "token", variable: "VERCEL_TOKEN" },
      { field: "teamId", variable: "VERCEL_TEAM_ID" },
      { field: "projectId", variable: "VERCEL_PROJECT_ID" },
    ],
  },
  xai: apiKey("XAI_API_KEY"),
};

export const SUBSCRIPTION_INTEGRATIONS: ReadonlySet<string> = new Set([
  "codex",
  "opencode",
  "pi",
]);

export const variablesFor = (integrationId: string): readonly string[] =>
  VARIABLE_CREDENTIALS[integrationId]?.fields.map(({ variable }) => variable) ??
  [];

export const requiredVariablesFor = (
  integrationId: string
): readonly string[] =>
  VARIABLE_CREDENTIALS[integrationId]?.fields.flatMap(
    ({ optional, variable }) => (optional === true ? [] : [variable])
  ) ?? [];

export const credentialFromVariables = (
  integrationId: string,
  values: ReadonlyMap<string, string>
):
  | { readonly authMethodId: string; readonly values: Record<string, string> }
  | undefined => {
  const mapping = VARIABLE_CREDENTIALS[integrationId];
  if (mapping === undefined) {
    return;
  }
  const missing = mapping.fields.some(
    ({ optional, variable }) => optional !== true && !values.has(variable)
  );
  if (missing) {
    return;
  }
  return {
    authMethodId: mapping.authMethodId,
    values: Object.fromEntries(
      mapping.fields.flatMap(({ field, variable }) => {
        const value = values.get(variable);
        return value === undefined ? [] : [[field, value] as const];
      })
    ),
  };
};
