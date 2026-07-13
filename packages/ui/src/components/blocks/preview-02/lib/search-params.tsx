"use client";

// Local stand-in for the shadcn site design-system builder hook.
// The preview cards only read `params.style` to decide corner rounding,
// so we return a stable rounded style and ignore URL state entirely.
function useDesignSystemSearchParams() {
  return [{ style: "mira" }] as const;
}

export { useDesignSystemSearchParams };
