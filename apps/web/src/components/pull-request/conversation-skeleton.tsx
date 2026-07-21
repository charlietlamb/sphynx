import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import { SectionHeader } from "@/components/layout/section-header";

const ITEM_KEYS = ["first", "second", "third"];
const REVIEWER_KEYS = ["one", "two"];

const headerIcon = <Skeleton className="size-2.5 rounded-[2px]" />;

export function ConversationSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex w-full max-w-3xl flex-col gap-3 px-4 py-4">
          <div className="flex flex-col gap-2.5 rounded-md border border-border bg-background p-3.5">
            <div className="flex items-center gap-2">
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="ml-auto h-3 w-8" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          {ITEM_KEYS.map((key) => (
            <div
              className="flex flex-col gap-2.5 rounded-md border border-border bg-background p-3.5"
              key={key}
            >
              <div className="flex items-center gap-2">
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="ml-auto h-3 w-8" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
          <div className="flex flex-col gap-2.5 rounded-md border border-border bg-background p-3.5">
            <Skeleton className="h-16 w-full rounded-md" />
            <div className="flex justify-end">
              <Skeleton className="h-6 w-20 rounded-md" />
            </div>
          </div>
        </div>
      </div>
      <aside className="hidden min-h-0 w-[26rem] shrink-0 flex-col border-border border-l lg:flex">
        <div className="flex flex-col gap-2 border-border border-b px-4 pb-2">
          <SectionHeader icon={headerIcon} label="Overview" />
          <div className="flex items-center gap-5 py-0.5">
            {ITEM_KEYS.map((key) => (
              <div className="flex items-center gap-1.5" key={key}>
                <Skeleton className="size-3.5 rounded-sm" />
                <Skeleton className="h-3 w-6" />
              </div>
            ))}
            <Skeleton className="ml-auto h-3 w-20" />
          </div>
          <Skeleton className="h-[3px] w-full rounded-full" />
        </div>
        <div className="flex flex-col gap-2 px-4 pb-2">
          <SectionHeader icon={headerIcon} label="Reviewers" />
          {REVIEWER_KEYS.map((key) => (
            <div className="flex items-center gap-2" key={key}>
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="ml-auto size-3.5 rounded-full" />
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
