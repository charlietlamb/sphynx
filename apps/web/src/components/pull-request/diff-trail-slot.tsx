import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

interface DiffTrailSlotValue {
  setTrail: (node: ReactNode) => void;
  trail: ReactNode;
}

const DiffTrailSlotContext = createContext<DiffTrailSlotValue | null>(null);

/**
 * A portal-like slot so the diff's definition-trail breadcrumb can render up in
 * the header row (with the tabs) while its controls stay wired to the review
 * store down in the workspace. Keeps the trail out of the diff's own scroll flow
 * so opening a definition pane never shifts the layout.
 */
export function DiffTrailSlotProvider({ children }: { children: ReactNode }) {
  const [trail, setTrail] = useState<ReactNode>(null);
  const value = useMemo(() => ({ trail, setTrail }), [trail]);
  return (
    <DiffTrailSlotContext.Provider value={value}>
      {children}
    </DiffTrailSlotContext.Provider>
  );
}

/** Read the current trail node — rendered by the header. */
export function useDiffTrailSlot(): ReactNode {
  return useContext(DiffTrailSlotContext)?.trail ?? null;
}

/** Publish the trail node from the workspace; clears it on unmount. */
export function usePublishDiffTrail(node: ReactNode) {
  const context = useContext(DiffTrailSlotContext);
  const setTrail = context?.setTrail;
  useEffect(() => {
    if (!setTrail) {
      return;
    }
    setTrail(node);
    return () => setTrail(null);
  }, [setTrail, node]);
}
