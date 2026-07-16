import { WorkerPoolContextProvider } from "@pierre/diffs/react";
import DiffsWorker from "@pierre/diffs/worker/worker.js?worker";
import type { ReactNode } from "react";

const poolOptions = {
  workerFactory: () => new DiffsWorker(),
};

const highlighterOptions = {
  useTokenTransformer: true,
};

export function DiffWorkerPool({ children }: { children: ReactNode }) {
  return (
    <WorkerPoolContextProvider
      highlighterOptions={highlighterOptions}
      poolOptions={poolOptions}
    >
      {children}
    </WorkerPoolContextProvider>
  );
}
