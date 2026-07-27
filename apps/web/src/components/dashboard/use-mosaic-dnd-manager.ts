import { createDragDropManager, type DragDropManager } from "dnd-core";
import { useState } from "react";
import { HTML5Backend } from "react-dnd-html5-backend";

/**
 * react-mosaic defaults to a MultiBackend (HTML5 + touch) wired through
 * `rdndmb-html5-to-touch`, which comes through Vite's dep optimizer with an
 * empty backends pipeline — so its `setup()` registers no `dragstart` listeners
 * and window drag is silently dead (resize still works, since that is not
 * react-dnd). We sidestep it by owning a plain HTML5-only manager and handing it
 * to `<Mosaic dragAndDropManager>`. Desktop-only dashboard, so touch is moot.
 *
 * Built once, on the client only (the Mosaic itself is client-gated), so the
 * backend binds to the real window with live `dragstart` listeners. `null` on
 * the server; the Mosaic is not rendered there.
 */
export function useMosaicDndManager(): DragDropManager | undefined {
  const [manager] = useState<DragDropManager | undefined>(() =>
    typeof window === "undefined"
      ? undefined
      : createDragDropManager(HTML5Backend)
  );
  return manager;
}
