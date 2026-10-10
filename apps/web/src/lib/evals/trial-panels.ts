import { preloadable } from "@/lib/preloadable";

export const ConversationPanel = preloadable(
  async () => (await import("@/components/evals/conversation")).Conversation
);

export const ChecksPanel = preloadable(
  async () => (await import("@/components/evals/trial-checks")).TrialChecks
);

export const FilesPanel = preloadable(
  async () => (await import("@/components/evals/trial-files")).TrialFiles
);

export const CallsPanel = preloadable(
  async () => (await import("@/components/evals/trial-calls")).TrialCalls
);

export const StepPanePanel = preloadable(
  async () => (await import("@/components/evals/step-pane")).StepPane
);

export const ConversationPanePanel = preloadable(
  async () =>
    (await import("@/components/evals/conversation-pane")).ConversationPane
);

export const preloadTrialPanels = () => {
  for (const panel of [
    ConversationPanel,
    ChecksPanel,
    FilesPanel,
    CallsPanel,
    StepPanePanel,
    ConversationPanePanel,
  ]) {
    panel.preload();
  }
};
