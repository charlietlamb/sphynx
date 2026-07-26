import type { ReactNode } from "react";

interface PanelCardProps {
  children?: ReactNode;
  description: string;
  heading?: "h1" | "h2";
  title: string;
}

export function PanelCard({
  children,
  description,
  heading = "h2",
  title,
}: PanelCardProps) {
  const Heading = heading;
  return (
    <div className="w-full max-w-md border border-border bg-background p-8 text-left">
      <div className="flex flex-col gap-3">
        <Heading className="font-heading text-2xl tracking-tight">
          {title}
        </Heading>
        <p className="text-muted-foreground text-sm">{description}</p>
        {children}
      </div>
    </div>
  );
}
