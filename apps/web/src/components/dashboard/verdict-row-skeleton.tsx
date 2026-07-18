import { Skeleton } from "@sphynx/ui/components/ui/skeleton";

interface VerdictRowSkeletonProps {
  nameWidth: string;
}

export function VerdictRowSkeleton({ nameWidth }: VerdictRowSkeletonProps) {
  return (
    <div className="flex h-9 items-center gap-2.5">
      <Skeleton className="size-5 shrink-0 rounded-full" />
      <span className="min-w-0 flex-1">
        <Skeleton className="h-3.5" style={{ width: nameWidth }} />
      </span>
      <Skeleton className="h-3.5 w-16 shrink-0" />
      <Skeleton className="h-3 w-7 shrink-0" />
    </div>
  );
}
