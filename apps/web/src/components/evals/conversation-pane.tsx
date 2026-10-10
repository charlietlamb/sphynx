import type { EvalTrial } from "@anpord/schema/domain/eval-trial";
import { PageTabs } from "@anpord/ui/components/ui/page-tabs";
import { useState } from "react";
import { ConversationFiles } from "@/components/evals/conversation-files";
import { ConversationOverview } from "@/components/evals/conversation-overview";
import { TrialCalls } from "@/components/evals/trial-calls";
import {
  countConversation,
  writtenPaths,
} from "@/lib/evals/conversation-totals";

type PaneTab = "overview" | "files" | "calls";

const TABS: readonly { readonly label: string; readonly value: PaneTab }[] = [
  { label: "Overview", value: "overview" },
  { label: "Files", value: "files" },
  { label: "Calls", value: "calls" },
];

export function ConversationPane({ trial }: { readonly trial: EvalTrial }) {
  const [tab, setTab] = useState<PaneTab>("overview");
  const [file, setFile] = useState<string | null>(null);
  const paths = writtenPaths(trial.artifacts, trial.filesChanged);
  const openFile = (path: string) => {
    setFile(path);
    setTab("files");
  };

  return (
    <aside
      aria-label="Conversation details"
      className="flex h-full min-h-0 flex-col bg-background"
    >
      <header className="flex h-11 shrink-0 items-center border-b px-3">
        <PageTabs onChange={setTab} options={TABS} value={tab} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        {tab === "overview" ? (
          <ConversationOverview
            onOpenFile={openFile}
            paths={paths}
            totals={countConversation(trial.trajectory, paths)}
          />
        ) : null}
        {tab === "files" ? (
          <ConversationFiles
            artifacts={trial.artifacts}
            onOpen={setFile}
            paths={paths}
            selected={file}
            trial={{ trialId: trial.id }}
          />
        ) : null}
        {tab === "calls" ? <TrialCalls trajectory={trial.trajectory} /> : null}
      </div>
    </aside>
  );
}
