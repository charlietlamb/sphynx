import { buttonVariants } from "@sphynx/ui/components/ui/button";
import { cn } from "@sphynx/ui/lib/utils";
import { GithubIcon } from "@/components/icons/github-icon";

export function GithubLink({ href }: { href: string }) {
  return (
    <a
      aria-label="Open on GitHub"
      className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))}
      href={href}
      rel="noreferrer"
      target="_blank"
      title="Open on GitHub"
    >
      <GithubIcon />
    </a>
  );
}
