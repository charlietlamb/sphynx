import { FileTypeIcon } from "@/components/pull-request/file-type-icon";

export function renderFileTypePrefix(item: { id: string }) {
  return <FileTypeIcon className="size-3.5 text-foreground" path={item.id} />;
}
