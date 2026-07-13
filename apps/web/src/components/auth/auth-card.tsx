import { toast } from "sonner";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { SocialButton } from "@/components/auth/social-button";
import { GithubIcon } from "@/components/icons/github-icon";
import { GoogleIcon } from "@/components/icons/google-icon";
import { signIn } from "@/lib/auth-client";

const PROVIDER_LABEL = { github: "GitHub", google: "Google" } as const;

async function signInWith(provider: "github" | "google") {
  try {
    const { error } = await signIn.social({ provider, callbackURL: "/" });
    if (!error) {
      return;
    }
    toast.error(`Couldn't sign in with ${PROVIDER_LABEL[provider]}`, {
      description: error.message,
    });
  } catch {
    toast.error(`Couldn't sign in with ${PROVIDER_LABEL[provider]}`, {
      description: "Can't reach the server. Please try again.",
    });
  }
}

export function AuthCard() {
  return (
    <div className="relative w-full max-w-sm bg-background p-8 text-left before:absolute before:top-[-9999px] before:bottom-0 before:left-0 before:w-px before:bg-border before:content-[''] after:absolute after:top-0 after:right-0 after:bottom-[-9999px] after:w-px after:bg-border after:content-['']">
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

      <div className="mt-7 flex flex-col gap-2.5">
        <SocialButton
          icon={<GoogleIcon />}
          onClick={() => signInWith("google")}
        >
          Continue with Google
        </SocialButton>
        <SocialButton
          icon={<GithubIcon />}
          onClick={() => signInWith("github")}
        >
          Continue with GitHub
        </SocialButton>
      </div>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.18em]">
          or
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <MagicLinkForm />
    </div>
  );
}
