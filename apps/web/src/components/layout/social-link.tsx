import type { ReactNode } from "react";

interface SocialLinkProps {
  children: ReactNode;
  href: string;
  label: string;
}

export function SocialLink({ href, label, children }: SocialLinkProps) {
  return (
    <a
      aria-label={label}
      className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );
}
