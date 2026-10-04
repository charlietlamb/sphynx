import type { SubscriptionPlan } from "@sphynx/schema/domain/credentials";

export interface PlanCopy {
  readonly authFileCommand: string | null;
  readonly blurb: string;
  readonly connected: string;
  readonly harness: string;
  readonly label: string;
  readonly ready: string;
}

export const PLANS: Readonly<Record<SubscriptionPlan, PlanCopy>> = {
  chatgpt: {
    authFileCommand: null,
    blurb: "Runs Codex",
    connected: "ChatGPT connected",
    harness: "codex",
    label: "ChatGPT",
    ready: "Codex can run on your ChatGPT plan now.",
  },
  opencode: {
    authFileCommand: "cat ~/.local/share/opencode/auth.json",
    blurb: "Paste your auth file",
    connected: "OpenCode added",
    harness: "opencode",
    label: "OpenCode",
    ready: "OpenCode can run on your plan now.",
  },
  pi: {
    authFileCommand: "cat ~/.pi/agent/auth.json",
    blurb: "Paste your auth file",
    connected: "Pi added",
    harness: "pi",
    label: "Pi",
    ready: "Pi can run on your plan now.",
  },
};

export const PLAN_ORDER: readonly SubscriptionPlan[] = [
  "chatgpt",
  "opencode",
  "pi",
];
