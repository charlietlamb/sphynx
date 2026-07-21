import { Skeleton } from "@sphynx/ui/components/ui/skeleton";

export function SwitcherSkeleton() {
  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className="flex h-7 items-center gap-2 rounded-md border border-transparent px-2">
        <Skeleton className="size-4 rounded-[4px]" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="size-3 rounded-sm" />
      </span>
    </span>
  );
}
