import { CopyPathButton } from "@/components/pull-request/copy-path-button";
import { FileTypeIcon } from "@/components/pull-request/file-type-icon";

export function renderFileTypePrefix(item: { id: string }) {
  return (
    <>
      <span className="flex items-center" data-file-icon="">
        <FileTypeIcon className="size-3.5 text-foreground" path={item.id} />
      </span>
      <CopyPathButton path={item.id} />
    </>
  );
}
