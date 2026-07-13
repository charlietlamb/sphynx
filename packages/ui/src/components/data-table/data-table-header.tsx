import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react";
import { useDataTableContext } from "@sphynx/ui/components/data-table/data-table-context";
import {
  TableHeader as ShadcnTableHeader,
  TableHead,
  TableRow,
} from "@sphynx/ui/components/ui/table";
import { cn } from "@sphynx/ui/lib/utils";
import { flexRender, type HeaderGroup } from "@tanstack/react-table";

function SortIcon({ direction }: { direction: "asc" | "desc" | false }) {
  if (direction === "asc") {
    return <CaretUpIcon className="size-3.5 shrink-0" />;
  }
  return (
    <CaretDownIcon
      className={cn("size-3.5 shrink-0", direction ? "" : "opacity-30")}
    />
  );
}

function HeaderCell<T>({
  header,
}: {
  header: HeaderGroup<T>["headers"][number];
}) {
  const { enableSorting } = useDataTableContext();

  if (header.isPlaceholder) {
    return null;
  }

  const content = flexRender(
    header.column.columnDef.header,
    header.getContext()
  );

  if (!(enableSorting && header.column.getCanSort())) {
    return <span className="truncate">{content}</span>;
  }

  return (
    <button
      className="flex select-none items-center gap-1"
      onClick={header.column.getToggleSortingHandler()}
      type="button"
    >
      {content}
      <SortIcon direction={header.column.getIsSorted()} />
    </button>
  );
}

export function DataTableHeader() {
  const { table } = useDataTableContext();

  return (
    <ShadcnTableHeader className="sticky top-0 z-10 [&_tr]:border-b [&_tr]:bg-muted/40">
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id}>
          {headerGroup.headers.map((header, index) => (
            <TableHead
              className={cn(
                "h-9 px-3 font-medium text-muted-foreground text-xs",
                index === 0 && "w-full pl-4"
              )}
              key={header.id}
              style={{ minWidth: `${header.getSize()}px` }}
            >
              <HeaderCell header={header} />
            </TableHead>
          ))}
        </TableRow>
      ))}
    </ShadcnTableHeader>
  );
}
