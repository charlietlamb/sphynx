import { useState } from "react";
import { useWorkbenchEvents } from "@/components/workbench/use-workbench-events";

export function useWorkbench(
  owner: string | null,
  repo: string | null,
  installationId: number | null,
  pullTitles: ReadonlyMap<number, string>
) {
  const [open, setOpen] = useState(false);
  const key = `${owner}/${repo}`;
  const [seen, setSeen] = useState({ key, at: Date.now() });
  const data = useWorkbenchEvents(
    owner ?? "",
    repo ?? "",
    installationId,
    Boolean(owner && repo),
    pullTitles,
    seen.key === key ? seen.at : 0
  );

  const setSheetOpen = (next: boolean) => {
    if (next) {
      setSeen({ key, at: Date.now() });
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
