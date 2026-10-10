import { StepProperties } from "@/components/evals/step-properties";
import { WrittenFileList } from "@/components/evals/written-file-list";
import type { ConversationTotals } from "@/lib/evals/conversation-totals";

export function ConversationOverview({
  onOpenFile,
  paths,
  totals,
}: {
  readonly onOpenFile: (path: string) => void;
  readonly paths: readonly string[];
  readonly totals: ConversationTotals;
}) {
  return (
    <div className="flex flex-col gap-5">
      <StepProperties
        rows={[
          ["Turns", totals.turns],
          ["Commands", totals.commands],
          ["Tool calls", totals.toolCalls],
          [
            "Failed",
            <span
              className={totals.failed > 0 ? "text-destructive" : undefined}
              key="failed"
            >
              {totals.failed}
            </span>,
          ],
          ["Files written", totals.files],
        ]}
      />
      {paths.length === 0 ? null : (
        <section className="flex flex-col gap-2 border-t pt-4">
          <h4 className="text-muted-foreground text-xs">Files written</h4>
          <WrittenFileList onOpen={onOpenFile} paths={paths} selected={null} />
        </section>
      )}
    </div>
  );
}
