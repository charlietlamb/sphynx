import { FileTypeIcon } from "@/components/pull-request/file-type-icon";

export function renderFileTypePrefix(item: { id: string }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted/60 text-foreground [&_svg]:size-3">
      <FileTypeIcon path={item.id} />
    </span>
  );
}
