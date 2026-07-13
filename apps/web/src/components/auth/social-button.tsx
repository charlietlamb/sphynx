import { Button } from "@sphynx/ui/components/ui/button";
import type { ReactNode } from "react";

interface SocialButtonProps {
  children: ReactNode;
  disabled?: boolean;
  icon: ReactNode;
  onClick: () => void;
}

export function SocialButton({
  children,
  disabled,
  icon,
  onClick,
}: SocialButtonProps) {
  return (
    <Button
      className="h-10 w-full justify-center gap-2.5 text-sm"
      disabled={disabled}
      onClick={onClick}
      size="lg"
      type="button"
      variant="outline"
    >
      {icon}
      {children}
    </Button>
  );
}
