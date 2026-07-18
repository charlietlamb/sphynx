import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import { VerdictRowSkeleton } from "@/components/dashboard/verdict-row-skeleton";

const REVIEWER_WIDTHS = ["5.5rem", "7rem", "4.5rem"];

export function DossierSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-2 border-border border-b px-5 py-4">
        <span className="flex h-[16.5px] items-center">
          <Skeleton className="h-3 w-44" />
        </span>
        <div className="flex flex-col">
          <span className="flex h-[27.5px] items-center">
            <Skeleton className="h-5 w-11/12" />
          </span>
          <span className="flex h-[27.5px] items-center">
            <Skeleton className="h-5 w-3/5" />
          </span>
        </div>
        <div className="flex h-[16.5px] items-center gap-2">
          <Skeleton className="size-4 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
      <div className="flex flex-col gap-0.5 border-border border-b px-5 py-3.5">
        <span className="flex h-[19px] items-center">
          <Skeleton className="h-3.5 w-2/5" />
        </span>
        <span className="flex h-[18px] items-center">
          <Skeleton className="h-3 w-2/3" />
        </span>
      </div>
      <div className="flex flex-col gap-1 border-border border-b px-5 py-4">
        <p className="font-medium text-[11px] text-muted-foreground/60">
          verdicts
        </p>
        {REVIEWER_WIDTHS.map((width) => (
          <VerdictRowSkeleton key={width} nameWidth={width} />
        ))}
        <span className="flex h-[18px] items-center pt-1">
          <Skeleton className="h-3 w-24" />
        </span>
      </div>
      <div className="mt-auto flex h-[41.5px] items-center gap-4 px-5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-6" />
      </div>
      <div className="flex items-center justify-end gap-2 border-border border-t px-5 py-3">
        <Skeleton className="h-7 w-16 rounded-md" />
        <Skeleton className="h-7 w-16 rounded-md" />
        <Skeleton className="h-7 w-20 rounded-md" />
      </div>
    </div>
  );
}
