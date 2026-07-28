import { DiffCardSkeleton } from "@/components/pull-request/diff-card-skeleton";
import { FileListSkeleton } from "@/components/pull-request/file-list-skeleton";

export function WorkspaceSkeleton() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 gap-2.5 overflow-hidden">
      <FileListSkeleton />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2.5">
        <DiffCardSkeleton />
        <DiffCardSkeleton lines={6} />
      </div>
    </div>
  );
}
