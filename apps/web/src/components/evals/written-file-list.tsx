import { cn } from "@anpord/ui/lib/utils";
import { fileIcon } from "@/lib/evals/file-presentation";

export function WrittenFileList({
  onOpen,
  paths,
  selected,
}: {
  readonly onOpen: (path: string) => void;
  readonly paths: readonly string[];
  readonly selected: string | null;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {paths.map((path) => {
        const Glyph = fileIcon(path);

        return (
          <li key={path}>
            <button
              aria-pressed={selected === path}
              className={cn(
                "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left font-mono text-foreground text-xs outline-none transition-colors hover:bg-alpha-4 focus-visible:bg-alpha-4",
                selected === path && "bg-alpha-4"
              )}
              onClick={() => onOpen(path)}
              type="button"
            >
              <Glyph aria-hidden className="size-4 shrink-0" />
              <span className="min-w-0 truncate">{path}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
