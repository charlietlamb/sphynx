import { Button } from "@sphynx/ui/components/ui/button";
import { signInWithGithub } from "@/components/auth/sign-in";
import { GithubIcon } from "@/components/icons/github-icon";
import { CrosshairCard } from "@/components/layout/crosshair-card";

interface AuthCardProps {
  redirect?: string;
}

export function AuthCard({ redirect }: AuthCardProps) {
  return (
    <CrosshairCard>
      <h1 className="font-heading text-2xl tracking-tight">
        Sign in to Sphynx
      </h1>
      <p className="mt-2 text-muted-foreground text-sm">
        Review pull requests with your team.
      </p>

      <Button
        className="mt-7 h-10 w-full"
        onClick={() => signInWithGithub(redirect ?? "/")}
        type="button"
        variant="outline"
      >
        <GithubIcon />
        Sign in with GitHub
      </Button>

      <p className="mt-4 text-[11px] text-muted-foreground/50 leading-relaxed">
        You'll choose which organizations Sphynx can access when you install the
        GitHub App.
      </p>
    </CrosshairCard>
  );
}
