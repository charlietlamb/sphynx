import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import { SectionHeader } from "@/components/layout/section-header";
import { TimelineRow } from "@/components/pull-request/timeline-row";

const ROW_KEYS = ["first", "second", "third"];
const REVIEWER_KEYS = ["one", "two"];

const headerIcon = <Skeleton className="size-2.5 rounded-[2px]" />;
const avatarNode = <Skeleton className="size-7 rounded-full" />;
const iconNode = <Skeleton className="size-6 rounded-full" />;

export function ConversationSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-6">
          <TimelineRow node={avatarNode} variant="card">
            <div className="flex flex-col gap-2.5 rounded-md border border-border bg-background p-3.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="ml-auto h-3 w-8" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          </TimelineRow>
          {ROW_KEYS.map((key) => (
            <TimelineRow key={key} node={iconNode} variant="row">
              <div className="flex items-center gap-2 py-[3px]">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-48" />
                <Skeleton className="ml-auto h-3 w-8" />
              </div>
            </TimelineRow>
          ))}
          <TimelineRow last node={avatarNode} variant="card">
            <div className="flex flex-col gap-2.5 rounded-md border border-border bg-background p-3.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="ml-auto h-3 w-8" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </TimelineRow>
          <div className="pt-2 pl-10">
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
        </div>
      </div>
      <aside className="hidden min-h-0 w-[26rem] shrink-0 flex-col border-border border-l lg:flex">
        <div className="flex flex-col gap-2 border-border border-b px-4 pb-2">
          <SectionHeader icon={headerIcon} label="Overview" />
          <div className="flex items-center gap-5 py-0.5">
            {ROW_KEYS.map((key) => (
              <div className="flex items-center gap-1.5" key={key}>
                <Skeleton className="size-3.5 rounded-sm" />
                <Skeleton className="h-3 w-6" />
              </div>
            ))}
            <Skeleton className="ml-auto h-3 w-20" />
          </div>
          <Skeleton className="h-[3px] w-full rounded-full" />
        </div>
        <div className="flex flex-col border-border border-b px-4">
          <SectionHeader icon={headerIcon} label="Reviewers" />
          <div className="flex flex-col divide-y divide-border/40">
            {REVIEWER_KEYS.map((key) => (
              <div
                className="-mx-4 flex items-center gap-2 px-4 py-2"
                key={key}
              >
                <Skeleton className="size-4 shrink-0 rounded-full" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="ml-auto h-3 w-8" />
                <Skeleton className="size-3.5 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 border-border border-b px-4 pb-2">
          <SectionHeader icon={headerIcon} label="Participants" />
          <div className="flex items-center">
            <div className="flex -space-x-1.5">
              {REVIEWER_KEYS.map((key) => (
                <Skeleton
                  className="size-5 rounded-full ring-2 ring-background"
                  key={key}
                />
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
