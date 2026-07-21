import { Skeleton } from "@sphynx/ui/components/ui/skeleton";

const LINE_WIDTHS = [
  "42%",
  "68%",
  "55%",
  "30%",
  "73%",
  "48%",
  "61%",
  "36%",
  "52%",
  "44%",
];

interface DiffCardSkeletonProps {
  lines?: number;
}

export function DiffCardSkeleton({ lines = 10 }: DiffCardSkeletonProps) {
  return (
    <div className="mr-4 flex flex-col border border-border">
      <div className="flex h-11 items-center gap-2 border-border border-b px-3">
        <Skeleton className="size-3.5 shrink-0 rounded-sm" />
        <Skeleton className="h-3 w-56" />
        <span className="flex-1" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="size-3.5 rounded-sm" />
      </div>
      <div className="flex flex-col pt-0 pb-2">
        {LINE_WIDTHS.slice(0, lines).map((width) => (
          <div className="flex h-5 items-center gap-3 px-3" key={width}>
            <Skeleton className="h-2.5 w-6 shrink-0" />
            <Skeleton className="h-2.5" style={{ width }} />
          </div>
        ))}
      </div>
    </div>
  );
}
