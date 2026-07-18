import type { QueuePull } from "@sphynx/schema/review-queue";
import { createDialogSystem } from "@sphynx/ui/components/dialog/create-dialog-system";

export interface DashboardDialogMap {
  blockPull: { pull: QueuePull };
  mergePull: { pull: QueuePull };
}

export const { DialogProvider, useDialog } =
  createDialogSystem<DashboardDialogMap>();
