import type {
  PullRequestFile,
  PullRequestRef,
} from "@sphynx/schema/pull-requests";
import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { CARD_SURFACE } from "@/components/layout/pane-card";
import {
  EMPTY_SYMBOLS,
  type PatchMap,
} from "@/components/pull-request/patch-map";
import { PullRequestHeaderSkeleton } from "@/components/pull-request/pull-request-header-skeleton";
import { WorkspaceSkeleton } from "@/components/pull-request/workspace-skeleton";
import { devOnly } from "@/lib/dev-only";

const DiffWorkspace = lazy(
  () => import("@/components/pull-request/diff-workspace")
);

const REF: PullRequestRef = { owner: "useautumn", repo: "autumn", number: 2 };

function file(
  path: string,
  over: Partial<PullRequestFile> = {}
): PullRequestFile {
  return {
    path,
    previousPath: null,
    sha: "0".repeat(40),
    status: "added",
    additions: 1,
    deletions: 0,
    changes: 1,
    renderability: "patch",
    githubUrl: `https://github.com/useautumn/autumn/pull/2/files#${path}`,
    ...over,
  };
}

const longBody = Array.from(
  { length: 60 },
  (_, i) => `+  const line${i + 1} = compute(${i + 1});`
).join("\n");

const FILES: PullRequestFile[] = [
  file("index.ts", { additions: 1, changes: 1 }),
  file("src/strategy/arbitrage.ts", { additions: 83, changes: 83 }),
  file("src/strategy/arbitrage.test.ts", { additions: 285, changes: 285 }),
  file("README.md", {
    status: "modified",
    additions: 4,
    deletions: 2,
    changes: 6,
  }),
];

const PATCHES: PatchMap = new Map([
  [
    "index.ts",
    '@@ -0,0 +1,2 @@\n+export * from "./src/odds-api/index.ts";\n+export * from "./src/strategy/index.ts";',
  ],
  [
    "src/strategy/arbitrage.ts",
    `@@ -0,0 +1,6 @@\n+export function findArbitrageCandidates(events: OddsEvent[]) {\n+  const candidates = [];\n${longBody}\n+  return candidates;\n+}`,
  ],
  [
    "src/strategy/arbitrage.test.ts",
    `@@ -0,0 +1,8 @@\n+import { expect, test } from "bun:test";\n+import type { OddsEvent } from "../odds-api/types.ts";\n+import { findArbitrageCandidates } from "./arbitrage.ts";\n${longBody}\n+test("returns candidates", () => {\n+  expect(findArbitrageCandidates([])).toEqual([]);\n+});`,
  ],
  [
    "README.md",
    "@@ -1,4 +1,6 @@\n # Autumn\n-Old line one\n-Old line two\n+New line one\n+New line two\n+New line three\n+New line four",
  ],
]);

function DevPr() {
  return (
    <main className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-2.5">
        <div className={CARD_SURFACE}>
          <PullRequestHeaderSkeleton pullRequestRef={REF} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <Suspense fallback={<WorkspaceSkeleton />}>
            <DiffWorkspace
              files={FILES}
              headSha={"0".repeat(40)}
              patches={PATCHES}
              pullRequestRef={REF}
              symbolIndex={EMPTY_SYMBOLS}
            />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/dev/pr")({
  beforeLoad: devOnly,
  component: DevPr,
});
