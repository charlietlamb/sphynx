import {
  type ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";

interface UseDataTableOptions<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  enableSorting?: boolean;
}

export function useDataTable<T>({
  data,
  columns,
  enableSorting = true,
}: UseDataTableOptions<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  return useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    enableSorting,
  });
}
