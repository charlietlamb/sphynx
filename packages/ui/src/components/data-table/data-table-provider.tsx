import {
  type DataTableConfig,
  DataTableContext,
} from "@sphynx/ui/components/data-table/data-table-context";
import type { ReactNode } from "react";

interface DataTableProviderProps<T> {
  children: ReactNode;
  config: DataTableConfig<T>;
}

export function DataTableProvider<T>({
  config,
  children,
}: DataTableProviderProps<T>) {
  return (
    <DataTableContext.Provider value={config}>
      {children}
    </DataTableContext.Provider>
  );
}
