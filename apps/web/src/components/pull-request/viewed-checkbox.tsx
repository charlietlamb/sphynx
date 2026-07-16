import { Checkbox } from "@sphynx/ui/components/ui/checkbox";
import { Link } from "@tanstack/react-router";

interface ViewedCheckboxProps {
  disabled?: boolean;
  onViewedChange: (viewed: boolean) => void;
  viewed: boolean;
}

export function ViewedCheckbox({
  disabled,
  onViewedChange,
  viewed,
}: ViewedCheckboxProps) {
  if (disabled) {
    return (
      <Link
        className="text-muted-foreground text-xs underline-offset-2 hover:underline"
        title="Viewed state syncs to GitHub once you sign in"
        to="/login"
      >
        Sign in to track viewed
      </Link>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
      <Checkbox
        aria-label="Mark file as viewed"
        checked={viewed}
        onCheckedChange={(checked) => onViewedChange(checked === true)}
      />
      Viewed
    </span>
  );
}
