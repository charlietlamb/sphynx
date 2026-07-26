import { Skeleton } from "@sphynx/ui/components/ui/skeleton";

export function SwitcherSkeleton() {
  return (
    <span className="flex min-w-0 items-center">
      <span className="flex h-7 items-center gap-2 px-1.5">
        <Skeleton className="size-4 rounded-[4px]" />
        <Skeleton className="h-3 w-20" />
      </span>
      <span className="select-none text-[13px] text-muted-foreground/40">
        /
      </span>
      <span className="flex h-7 items-center gap-1.5 px-1.5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="size-3 rounded-sm" />
      </span>
    </span>
  );
}
