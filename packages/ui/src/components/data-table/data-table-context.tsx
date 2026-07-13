import type { Table as TanstackTable } from "@tanstack/react-table";
import { createContext, type ReactNode, useContext } from "react";

export interface DataTableConfig<T> {
  emptyState?: ReactNode;
  enableSorting?: boolean;
  isLoading?: boolean;
  numberOfColumns: number;
  onRowClick?: (row: T) => void;
  rowClassName?: string;
  skeletonColumnCount?: number;
  skeletonRowCount?: number;
  table: TanstackTable<T>;
}

// biome-ignore lint/suspicious/noExplicitAny: context holds tables of any row type
export const DataTableContext = createContext<DataTableConfig<any> | null>(
  null
);

export function useDataTableContext<T>(): DataTableConfig<T> {
  const context = useContext(DataTableContext);
  if (!context) {
    throw new Error("useDataTableContext must be used within a DataTable");
  }
  return context as DataTableConfig<T>;
}
