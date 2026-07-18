import { DEFAULT_THEMES } from "@pierre/diffs";
import { useWorkerPool, WorkerPoolContextProvider } from "@pierre/diffs/react";
import DiffsWorker from "@pierre/diffs/worker/worker.js?worker";
import { type ReactNode, useEffect } from "react";
import { useSettings } from "@/components/settings/settings-provider";
import { CODE_THEMES } from "@/lib/settings";

const poolOptions = {
  workerFactory: () => new DiffsWorker(),
};

const highlighterOptions = {
  useTokenTransformer: true,
};

function WorkerThemeSync() {
  const pool = useWorkerPool();
  const { settings } = useSettings();
  const themes = CODE_THEMES[settings.codeTheme]?.themes;
  useEffect(() => {
    pool?.setRenderOptions({ theme: themes ?? DEFAULT_THEMES });
  }, [pool, themes]);
  return null;
}

export function DiffWorkerPool({ children }: { children: ReactNode }) {
  return (
    <WorkerPoolContextProvider
      highlighterOptions={highlighterOptions}
      poolOptions={poolOptions}
    >
      <WorkerThemeSync />
      {children}
    </WorkerPoolContextProvider>
  );
}
