import { cn } from "@sphynx/ui/lib/utils";

interface MountainTextureProps {
  className?: string;
  darkOpacity?: string;
  lightOpacity?: string;
}

export function MountainTexture({
  className,
  lightOpacity = "opacity-[0.07]",
  darkOpacity = "dark:opacity-[0.1]",
}: MountainTextureProps) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none overflow-hidden", className)}
    >
      <div
        className={cn(
          "absolute inset-0 bg-center bg-cover dark:hidden",
          lightOpacity
        )}
        style={{ backgroundImage: "url(/mountains-dither.webp)" }}
      />
      <div
        className={cn(
          "absolute inset-0 hidden bg-center bg-cover dark:block",
          darkOpacity
        )}
        style={{ backgroundImage: "url(/mountains-dither-dark.webp)" }}
      />
    </div>
  );
}
