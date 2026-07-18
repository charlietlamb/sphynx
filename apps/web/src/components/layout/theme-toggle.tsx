import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      aria-label="Toggle theme"
      className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="size-[1.125rem]"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          className="origin-center transition-all duration-300 ease-out"
          cx="12"
          cy="12"
          fill="currentColor"
          r={isDark ? 9 : 5}
          style={{ opacity: isDark ? 0 : 1 }}
        />
        <path
          className="transition-opacity duration-300 ease-out"
          d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
          fill="currentColor"
          style={{ opacity: isDark ? 1 : 0 }}
        />
        <g
          className="origin-center transition-all duration-300 ease-out"
          style={{
            opacity: isDark ? 0 : 1,
            transform: isDark ? "rotate(-45deg) scale(0.6)" : "none",
          }}
        >
          <path d="M12 1.5v2.25" />
          <path d="M12 20.25v2.25" />
          <path d="M4.22 4.22l1.59 1.59" />
          <path d="M18.19 18.19l1.59 1.59" />
          <path d="M1.5 12h2.25" />
          <path d="M20.25 12h2.25" />
          <path d="M4.22 19.78l1.59-1.59" />
          <path d="M18.19 5.81l1.59-1.59" />
        </g>
      </svg>
    </button>
  );
}
