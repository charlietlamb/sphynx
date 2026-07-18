import { Skeleton } from "@sphynx/ui/components/ui/skeleton";

export function SwitcherSkeleton() {
  return (
    <span className="flex items-center gap-1.5 px-1.5 py-0.5">
      <Skeleton className="h-6 w-28" />
      <Skeleton className="h-3 w-12" />
    </span>
  );
}
