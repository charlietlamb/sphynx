import { DataTable } from "@sphynx/ui/components/data-table/data-table";
import { useDataTable } from "@sphynx/ui/components/data-table/use-data-table";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";

interface DataTablePanelProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  emptyState: ReactNode;
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  skeletonColumnCount?: number;
}

export function DataTablePanel<T>({
  data,
  columns,
  isLoading,
  emptyState,
  onRowClick,
  skeletonColumnCount,
}: DataTablePanelProps<T>) {
  const table = useDataTable({ data, columns });

  return (
    <DataTable.Provider
      config={{
        table,
        numberOfColumns: columns.length,
        isLoading,
        enableSorting: true,
        emptyState,
        onRowClick,
        skeletonColumnCount,
      }}
    >
      <DataTable.Container>
        <DataTable.Header />
        <DataTable.Body />
      </DataTable.Container>
    </DataTable.Provider>
  );
}
