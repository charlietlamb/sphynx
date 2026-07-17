import { cn } from "@sphynx/ui/lib/utils";
import { useTheme } from "next-themes";

const APP_THEMES = ["light", "dark", "system"] as const;

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-secondary p-0.5">
      {APP_THEMES.map((option) => (
        <button
          className={cn(
            "rounded-[5px] px-2.5 py-1 text-xs capitalize transition-colors",
            theme === option
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
          key={option}
          onClick={() => setTheme(option)}
          type="button"
        >
          {option}
        </button>
      ))}
    </div>
  );
}
