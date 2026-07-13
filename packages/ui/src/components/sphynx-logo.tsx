import type { ComponentProps } from "react";

/**
 * Sphynx mark — a sharp Egyptian-cat face. Every segment sits on a strict
 * angle system (45° or 2:1 slopes only) so the mark reads as constructed,
 * not freehand. Keep clear space around it: in a square tile, render at
 * ~64% of the tile (e.g. size-9 inside size-14), centered.
 * Inherits color via `currentColor`; size with width/height or className.
 */
export function SphynxLogo(props: ComponentProps<"svg">) {
  return (
    <svg
      aria-label="Sphynx"
      fill="currentColor"
      role="img"
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        clipRule="evenodd"
        d="M27 4 L50 27 L73 4 L96 50 L50 96 L4 50 Z"
        fillRule="evenodd"
      />
    </svg>
  );
}
