import type {
  PullRequestFile,
  PullRequestRef,
} from "@sphynx/schema/pull-requests";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  fileContentsQuery,
  useFileContentsAction,
} from "@/components/pull-request/pull-request-queries";
import { buildImportGraph, type ImportGraph } from "@/lib/import-graph";

const SOURCE_FILE = /\.(?:m|c)?[jt]sx?$/;
const MAX_GRAPH_FILES = 40;

const graphEligible = (file: PullRequestFile) =>
  file.status !== "deleted" &&
  file.renderability === "patch" &&
  SOURCE_FILE.test(file.path);

export function useImportGraph(
  ref: PullRequestRef,
  headSha: string,
  files: readonly PullRequestFile[]
): ImportGraph {
  const eligible = useMemo(
    () => files.filter(graphEligible).slice(0, MAX_GRAPH_FILES),
    [files]
  );
  const getFileContents = useFileContentsAction();
  const contents = useQueries({
    queries: eligible.map((file) =>
      fileContentsQuery(getFileContents, ref, headSha, file.path)
    ),
    combine: (results) =>
      results
        .map((result, index) => ({
          path: eligible[index]?.path ?? "",
          content: result.data ?? null,
        }))
        .filter(
          (source): source is { path: string; content: string } =>
            source.path !== "" && source.content !== null
        ),
  });
  return useMemo(() => {
    const paths = new Set(files.map((file) => file.path));
    return buildImportGraph(contents, paths);
  }, [contents, files]);
}
