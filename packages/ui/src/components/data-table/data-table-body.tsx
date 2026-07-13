import { useDataTableContext } from "@sphynx/ui/components/data-table/data-table-context";
import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import {
  TableBody as ShadcnTableBody,
  TableCell,
  TableRow,
} from "@sphynx/ui/components/ui/table";
import { cn } from "@sphynx/ui/lib/utils";
import { flexRender } from "@tanstack/react-table";

const DEFAULT_SKELETON_ROWS = 5;
const SKELETON_WIDTHS = ["w-24", "w-20", "w-28", "w-16", "w-32"];

export function DataTableBody<T>() {
  const {
    table,
    numberOfColumns,
    isLoading,
    onRowClick,
    rowClassName,
    emptyState,
    skeletonColumnCount,
    skeletonRowCount = DEFAULT_SKELETON_ROWS,
  } = useDataTableContext<T>();

  const rows = table.getRowModel().rows;
  const leafColumns = table.getVisibleLeafColumns();

  if (isLoading) {
    const columnCount = skeletonColumnCount ?? leafColumns.length;
    return (
      <ShadcnTableBody>
        {Array.from({ length: skeletonRowCount }).map((_, rowIndex) => (
          <TableRow
            className={cn("h-12", rowClassName)}
            key={`skeleton-${rowIndex}`}
          >
            {Array.from({ length: columnCount }).map((__, columnIndex) => (
              <TableCell
                className={cn("px-3", columnIndex === 0 && "pl-4")}
                key={`skeleton-cell-${columnIndex}`}
              >
                <Skeleton
                  className={cn(
                    "h-3.5 rounded-sm",
                    SKELETON_WIDTHS[
                      (columnIndex * 2 + rowIndex) % SKELETON_WIDTHS.length
                    ]
                  )}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </ShadcnTableBody>
    );
  }

  if (rows.length === 0) {
    return (
      <ShadcnTableBody>
        <TableRow className="hover:bg-transparent">
          <TableCell className="h-24 text-center" colSpan={numberOfColumns}>
            <span className="text-muted-foreground text-sm">
              {emptyState ?? "No results."}
            </span>
          </TableCell>
        </TableRow>
      </ShadcnTableBody>
    );
  }

  return (
    <ShadcnTableBody>
      {rows.map((row) => (
        <TableRow
          className={cn("h-11", onRowClick && "cursor-pointer", rowClassName)}
          key={row.id}
          onClick={onRowClick ? () => onRowClick(row.original) : undefined}
        >
          {row.getVisibleCells().map((cell, cellIndex) => (
            <TableCell
              className={cn(
                "px-3 text-sm",
                cellIndex === 0 && "w-full pl-4 font-medium"
              )}
              key={cell.id}
              style={{ minWidth: `${cell.column.getSize()}px` }}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </ShadcnTableBody>
  );
}
