import { useState } from "react";
import { useWorkbenchEvents } from "@/components/workbench/use-workbench-events";
import { markWorkbenchSeen } from "@/components/workbench/workbench-store";

export function useWorkbench(
  owner: string | null,
  repo: string | null,
  authed: boolean
) {
  const [open, setOpen] = useState(false);
  const data = useWorkbenchEvents(
    owner ?? "",
    repo ?? "",
    authed,
    Boolean(owner && repo)
  );

  const setSheetOpen = (next: boolean) => {
    if (next) {
      markWorkbenchSeen();
    }
    setOpen(Boolean(next));
  };

  return {
    open,
    setOpen: setSheetOpen,
    toggle: () => setSheetOpen(!open),
    ...data,
  };
}
