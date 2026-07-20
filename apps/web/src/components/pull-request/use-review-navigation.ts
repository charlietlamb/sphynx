import type { PullRequestFile } from "@sphynx/schema/pull-requests";
import { useCallback, useRef } from "react";
import {
  type Handle,
  scrollToLine,
} from "@/components/pull-request/code-view-scroll";
import {
  type DefinitionRef,
  EMPTY_TRAIL,
  type PullRequestSearchSetter,
} from "@/components/pull-request/pull-request-search";
import type { ReviewStore } from "@/components/pull-request/use-review-state";

interface ReviewNavigationInput {
  applyTrail: (next: readonly DefinitionRef[], focus: 0 | 1) => void;
  file: string | null;
  files: readonly PullRequestFile[];
  line: number | null;
  setSearch: PullRequestSearchSetter;
  store: ReviewStore;
}

export function useReviewNavigation({
  applyTrail,
  file,
  files,
  line,
  setSearch,
  store,
}: ReviewNavigationInput) {
  const mainHandleRef = useRef<Handle>(null);
  const paneHandlesRef = useRef<Handle[]>([]);
  const initialTargetRef = useRef({ file, line });

  const attachMain = useCallback((handle: Handle) => {
    mainHandleRef.current = handle;
    const target = initialTargetRef.current;
    if (!(handle && target.file)) {
      return;
    }
    if (target.line === null) {
      handle.scrollTo({ type: "item", id: target.file, behavior: "instant" });
      return;
    }
    scrollToLine(handle, target.file, target.line, "center");
  }, []);

  const attachPane = useCallback((index: number, handle: Handle) => {
    paneHandlesRef.current[index] = handle;
  }, []);

  const columnHandle = useCallback(
    (column: 0 | 1): Handle => {
      const depthCount = store.read().trail.length;
      if (depthCount === 0) {
        return mainHandleRef.current;
      }
      if (depthCount === 1) {
        return column === 0
          ? mainHandleRef.current
          : (paneHandlesRef.current[0] ?? null);
      }
      const depth = column === 0 ? depthCount - 2 : depthCount - 1;
      return paneHandlesRef.current[depth] ?? null;
    },
    [store]
  );

  const setLine = useCallback(
    (path: string, nextLine: number) => {
      store.write({ path, line: nextLine });
      setSearch({ file: path, line: nextLine }, { history: "replace" });
    },
    [store, setSearch]
  );

  const setTrail = useCallback(
    (next: DefinitionRef[] | null) => {
      applyTrail(next ?? [], next && next.length > 0 ? 1 : 0);
      setSearch({ panes: next }, { history: "push" });
    },
    [applyTrail, setSearch]
  );

  const navigateFrom = useCallback(
    (index: number, definition: DefinitionRef) => {
      const parent =
        index === -1
          ? mainHandleRef.current
          : (paneHandlesRef.current[index] ?? null);
      if (definition.anchorPath && definition.anchorLine !== null) {
        scrollToLine(
          parent,
          definition.anchorPath,
          definition.anchorLine,
          "anchor"
        );
      }
      const next = [...store.read().trail.slice(0, index + 1), definition];
      applyTrail(next, 1);
      setSearch({ panes: next }, { history: "push" });
    },
    [store, applyTrail, setSearch]
  );

  const openTrail = useCallback(
    (definition: DefinitionRef) => navigateFrom(-1, definition),
    [navigateFrom]
  );

  const selectFile = useCallback(
    (path: string) => {
      const hadTrail = store.read().trail.length > 0;
      applyTrail(EMPTY_TRAIL, 0);
      store.write({ path, line: null });
      setSearch(
        { file: path, line: null, panes: null },
        { history: hadTrail ? "push" : "replace" }
      );
      mainHandleRef.current?.scrollTo({
        type: "item",
        id: path,
        behavior: "instant",
      });
    },
    [store, applyTrail, setSearch]
  );

  const stepFile = useCallback(
    (direction: 1 | -1) => {
      const index = files.findIndex(
        (candidate) => candidate.path === store.read().path
      );
      for (
        let next = index + direction;
        next >= 0 && next < files.length;
        next += direction
      ) {
        if (files[next].renderability === "patch") {
          selectFile(files[next].path);
          return;
        }
      }
    },
    [store, files, selectFile]
  );

  return {
    attachMain,
    attachPane,
    columnHandle,
    navigateFrom,
    openTrail,
    selectFile,
    setLine,
    setTrail,
    stepFile,
  };
}
