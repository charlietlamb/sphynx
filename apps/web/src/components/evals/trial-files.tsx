import type {
  EvalArtifactMetadata,
  EvalArtifactRequest,
} from "@sphynx/schema/domain/eval-trial";
import {
  DataTable,
  DataTableBody,
  DataTableHead,
} from "@sphynx/ui/components/ui/data-table";
import { useState } from "react";
import { FileSheet } from "@/components/evals/file-sheet";
import { TrialFileRow } from "@/components/evals/trial-file-row";
import { FILES_TABLE } from "@/lib/evals/case-tables";
import { writtenPaths } from "@/lib/evals/conversation-totals";

export function TrialFiles({
  artifacts,
  changed,
  trial,
}: {
  readonly artifacts: readonly EvalArtifactMetadata[];
  readonly changed: readonly string[];
  readonly trial: Omit<EvalArtifactRequest, "sha256" | "path">;
}) {
  const [openPath, setOpenPath] = useState<string | null>(null);
  const captured = new Map(artifacts.map((file) => [file.path, file]));
  const paths = writtenPaths(artifacts, changed);

  return (
    <>
      <DataTable columns={FILES_TABLE.columns} label={FILES_TABLE.label}>
        <DataTableHead headings={FILES_TABLE.headings} />
        <DataTableBody>
          {paths.map((path) => (
            <TrialFileRow
              file={captured.get(path)}
              key={path}
              onOpen={() => setOpenPath(path)}
              path={path}
            />
          ))}
        </DataTableBody>
      </DataTable>

      <FileSheet
        file={openPath === null ? undefined : captured.get(openPath)}
        onClose={() => setOpenPath(null)}
        trial={trial}
      />
    </>
  );
}
