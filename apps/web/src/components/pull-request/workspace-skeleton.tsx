import { DiffCardSkeleton } from "@/components/pull-request/diff-card-skeleton";
import { FileListSkeleton } from "@/components/pull-request/file-list-skeleton";

export function WorkspaceSkeleton() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <FileListSkeleton />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 px-4 py-3">
        <DiffCardSkeleton />
        <DiffCardSkeleton lines={6} />
      </div>
    </div>
  );
}
