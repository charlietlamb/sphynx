import { Skeleton } from "@sphynx/ui/components/ui/skeleton";

export function SwitcherSkeleton() {
  return (
    <span className="flex items-center gap-2 border border-transparent py-1 pr-2 pl-2.5">
      <Skeleton className="size-5 rounded-sm" />
      <Skeleton className="h-[18px] w-16" />
      <Skeleton className="size-3" />
    </span>
  );
}
