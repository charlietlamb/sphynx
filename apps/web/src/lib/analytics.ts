import { track } from "@databuddy/sdk";

interface AnalyticsEvents {
  comment_added: { owner: string; repo: string; number: number };
  installation_resynced: { installationId: number };
  pull_blocked: { owner: string; repo: string; number: number };
  pull_merged: { owner: string; repo: string; number: number };
  sign_in_started: { provider: "github" };
  signed_out: Record<string, never>;
  thread_resolved: { owner: string; repo: string; number: number };
}

export function trackEvent<Name extends keyof AnalyticsEvents>(
  name: Name,
  properties: AnalyticsEvents[Name]
) {
  track(name, properties);
}
