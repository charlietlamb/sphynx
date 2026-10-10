export const POPUP =
  "rounded-lg border border-border bg-popover text-popover-foreground shadow-(--shadow-popover) outline-none";

export const POPUP_MOTION =
  "origin-(--transform-origin) duration-100 data-open:fade-in-0 data-open:zoom-in-95 data-open:animate-in data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:animate-out";

export const OVERLAY =
  "fixed inset-0 isolate z-50 bg-white/70 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 dark:bg-black/70";

export const MODAL = `${POPUP} ${POPUP_MOTION} fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl sm:max-w-sm`;

export const MENU_ITEM =
  "relative flex min-h-8 w-full cursor-default select-none items-center gap-2.5 rounded-md px-2 py-1 text-[13px]/5 text-muted-foreground outline-hidden focus:bg-alpha-8 focus:text-foreground focus:**:text-foreground data-highlighted:bg-alpha-8 data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0";

export const MENU_SEPARATOR = "-mx-1 my-1 h-px bg-border";

export const MENU_LABEL =
  "flex h-7 items-center justify-between gap-2 px-2 text-muted-foreground/80 text-xs";
