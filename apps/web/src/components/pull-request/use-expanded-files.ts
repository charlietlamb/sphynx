import type {
  PullRequestFile,
  PullRequestRef,
} from "@sphynx/schema/pull-requests";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { expandableFilePath } from "@/components/pull-request/full-contents";
import { fileContentsQuery } from "@/components/pull-request/pull-request-queries";

export type FileContents = ReadonlyMap<string, string>;

const MAX_EXPANDABLE_FILES = 40;

export function useExpandedFiles(
  ref: PullRequestRef,
  headSha: string,
  files: readonly PullRequestFile[]
): FileContents {
  const paths = useMemo(() => {
    const expandable: string[] = [];
    for (const file of files) {
      const path = expandableFilePath(file);
      if (path && expandable.length < MAX_EXPANDABLE_FILES) {
        expandable.push(path);
      }
    }
    return expandable;
  }, [files]);

  const results = useQueries({
    queries: paths.map((path) => fileContentsQuery(ref, headSha, path)),
  });

  return useMemo(() => {
    const map = new Map<string, string>();
    paths.forEach((path, index) => {
      const content = results[index]?.data?.content;
      if (typeof content === "string") {
        map.set(path, content);
      }
    });
    return map;
  }, [paths, results]);
}
