import { SealCheckIcon } from "@phosphor-icons/react";
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
        <span className="flex h-[18px] items-center">
          <Skeleton className="h-3 w-3/5" />
        </span>
        <div className="flex h-[16.5px] items-center gap-2">
          <Skeleton className="size-4 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-36" />
          <span className="ml-auto flex items-center gap-3">
            <Skeleton className="size-1.5 rounded-full" />
            <Skeleton className="h-[3px] w-7 rounded-full" />
            <Skeleton className="h-3 w-10" />
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1 border-border border-b px-5 pb-4">
        <div className="-mx-5 mb-2 flex items-center gap-1.5 border-border border-b px-5 py-2.5">
          <SealCheckIcon className="size-3 text-muted-foreground/60" />
          <p className="font-medium text-[11px] text-foreground">Verdicts</p>
        </div>
        {REVIEWER_WIDTHS.map((width) => (
          <VerdictRowSkeleton key={width} nameWidth={width} />
        ))}
        <span className="flex h-[18px] items-center pt-1">
          <Skeleton className="h-3 w-24" />
        </span>
      </div>
      <div className="mt-auto flex items-center justify-end gap-2 border-border border-t px-5 py-3">
        <Skeleton className="h-7 w-16 rounded-md" />
        <Skeleton className="h-7 w-16 rounded-md" />
        <Skeleton className="h-7 w-20 rounded-md" />
      </div>
    </div>
  );
}
