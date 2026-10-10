import type { EvalTrial } from "@anpord/schema/domain/eval-trial";
import {
  ResizableHandle,
  ResizablePanel,
} from "@anpord/ui/components/ui/resizable";
import { parseAsString, useQueryState } from "nuqs";
// biome-ignore lint/correctness/noUnresolvedImports: biome cannot see the Suspense export in the react types
import { Suspense } from "react";
import { ConversationPanePanel } from "@/lib/evals/trial-panels";
import { useSelectedStep } from "@/lib/evals/use-selected-step";

export function TrialConversationPane({
  trial,
}: {
  readonly trial: EvalTrial;
}) {
  const [tab] = useQueryState("tab", parseAsString);
  const [step] = useSelectedStep();

  if (tab !== "conversation" || step !== null) {
    return null;
  }

  return (
    <>
      <ResizableHandle withHandle />
      <ResizablePanel
        defaultSize="30%"
        id="conversation"
        maxSize="50%"
        minSize="22%"
      >
        <Suspense fallback={null}>
          <ConversationPanePanel.Component trial={trial} />
        </Suspense>
      </ResizablePanel>
    </>
  );
}
