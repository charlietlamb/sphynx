import type { QueuePull } from "@sphynx/schema/review-queue";
import { CiBar } from "@/components/dashboard/ci-bar";

export function CiSlot({ pull }: { pull: QueuePull }) {
  return (
    <span className="flex w-6 shrink-0 items-center justify-center">
      <CiBar pull={pull} />
    </span>
  );
}
