import type {
  EvalArtifactMetadata,
  EvalArtifactRequest,
} from "@anpord/schema/domain/eval-trial";
import { EmptyNote } from "@anpord/ui/components/ui/empty-note";
import { ArtifactFile } from "@/components/evals/artifact-file";
import { WrittenFileList } from "@/components/evals/written-file-list";

export function ConversationFiles({
  artifacts,
  onOpen,
  paths,
  selected,
  trial,
}: {
  readonly artifacts: readonly EvalArtifactMetadata[];
  readonly onOpen: (path: string) => void;
  readonly paths: readonly string[];
  readonly selected: string | null;
  readonly trial: Omit<EvalArtifactRequest, "sha256" | "path">;
}) {
  if (paths.length === 0) {
    return <EmptyNote>This trial wrote no files.</EmptyNote>;
  }

  const open = selected ?? paths[0] ?? null;
  const artifact = artifacts.find((file) => file.path === open);

  return (
    <div className="flex flex-col gap-4">
      <WrittenFileList onOpen={onOpen} paths={paths} selected={open} />
      {artifact === undefined ? (
        <EmptyNote>This file changed, but its contents weren't kept.</EmptyNote>
      ) : (
        <ArtifactFile artifact={artifact} key={artifact.path} trial={trial} />
      )}
    </div>
  );
}
