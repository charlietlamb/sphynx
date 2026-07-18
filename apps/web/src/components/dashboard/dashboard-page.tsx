import { BlockPullDialog } from "@/components/dashboard/block-pull-dialog";
import { DialogProvider } from "@/components/dashboard/dashboard-dialogs";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { MergePullDialog } from "@/components/dashboard/merge-pull-dialog";

const REGISTRY = {
  blockPull: BlockPullDialog,
  mergePull: MergePullDialog,
};

export function DashboardPage() {
  return (
    <DialogProvider registry={REGISTRY}>
      <DashboardView />
    </DialogProvider>
  );
}
