import { Button } from "@sphynx/ui/components/ui/button";
import { toast } from "sonner";
import { GithubIcon } from "@/components/icons/github-icon";
import { signIn } from "@/lib/auth-client";

async function signInWithGithub() {
  try {
    const { error } = await signIn.social({
      provider: "github",
      callbackURL: "/",
    });
    if (!error) {
      return;
    }
    toast.error("Couldn't sign in with GitHub", {
      description: error.message,
    });
  } catch {
    toast.error("Couldn't sign in with GitHub", {
      description: "Can't reach the server. Please try again.",
    });
  }
}

export function AuthCard() {
  return (
    <div className="relative w-full max-w-sm bg-background p-8 text-center before:absolute before:top-[-9999px] before:bottom-0 before:left-0 before:w-px before:bg-border before:content-[''] after:absolute after:top-0 after:right-0 after:bottom-[-9999px] after:w-px after:bg-border after:content-['']">
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 left-[-9999px] h-px bg-border"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-[-9999px] bottom-0 left-0 h-px bg-border"
      />
      <h1 className="font-heading text-2xl tracking-tight">
        Sign in to Sphynx
      </h1>
      <p className="mt-2 text-muted-foreground text-sm">
        Review pull requests with your team.
      </p>

      <Button
        aria-label="Continue with GitHub"
        className="mt-7 size-14 rounded-xl [&_svg]:size-6"
        onClick={signInWithGithub}
        size="icon-lg"
        type="button"
        variant="outline"
      >
        <GithubIcon />
      </Button>
    </div>
  );
}
