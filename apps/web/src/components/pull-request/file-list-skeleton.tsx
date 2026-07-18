import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import { useSettings } from "@/components/settings/settings-provider";

const ROWS: readonly { id: string; indent: number; width: string }[] = [
  { id: "root", indent: 0, width: "3.5rem" },
  { id: "dir-a", indent: 1, width: "5rem" },
  { id: "file-a1", indent: 2, width: "6.5rem" },
  { id: "file-a2", indent: 2, width: "5.5rem" },
  { id: "file-a3", indent: 2, width: "4.5rem" },
  { id: "dir-b", indent: 1, width: "4.5rem" },
  { id: "file-b1", indent: 2, width: "7rem" },
  { id: "file-b2", indent: 2, width: "4rem" },
  { id: "file-b3", indent: 2, width: "5.5rem" },
  { id: "dir-c", indent: 1, width: "6rem" },
  { id: "file-c1", indent: 2, width: "5rem" },
  { id: "file-c2", indent: 2, width: "6.5rem" },
  { id: "file-c3", indent: 2, width: "4.5rem" },
  { id: "dir-d", indent: 1, width: "5.5rem" },
  { id: "file-d1", indent: 2, width: "6rem" },
  { id: "file-d2", indent: 2, width: "5rem" },
  { id: "file-d3", indent: 2, width: "7rem" },
  { id: "file-d4", indent: 2, width: "4rem" },
];

export function FileListSkeleton() {
  const { settings } = useSettings();
  if (settings.sidebarCollapsed) {
    return (
      <div className="flex h-full w-10 shrink-0 flex-col items-center gap-2 border-border border-r py-1.5">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="h-2.5 w-4" />
      </div>
    );
  }
  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-border border-r">
      <div className="flex items-center justify-between gap-1 border-border border-b py-1 pr-2 pl-1">
        <span className="flex items-center gap-1">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="h-4 w-12" />
        </span>
        <Skeleton className="h-3.5 w-20" />
      </div>
      <div className="flex flex-col py-1">
        {ROWS.map((row) => (
          <div
            className="flex h-6 items-center gap-2 pr-3"
            key={row.id}
            style={{ paddingLeft: 10 + row.indent * 12 }}
          >
            {row.id.startsWith("dir") || row.id === "root" ? (
              <>
                <Skeleton className="size-3 shrink-0 rounded-sm" />
                <Skeleton className="size-3.5 shrink-0 rounded-sm" />
              </>
            ) : (
              <>
                <span className="w-3 shrink-0" />
                <Skeleton className="size-3.5 shrink-0 rounded-sm" />
              </>
            )}
            <Skeleton className="h-3" style={{ width: row.width }} />
            <span className="flex-1" />
            <Skeleton className="h-3 w-9" />
          </div>
        ))}
      </div>
    </div>
  );
}
