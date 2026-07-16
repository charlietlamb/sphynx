import { Button } from "@sphynx/ui/components/ui/button";
import { signInWithGithub } from "@/components/auth/sign-in";
import { GithubIcon } from "@/components/icons/github-icon";
import { useSession } from "@/lib/auth-client";

export function SignInButton() {
  const { data, isPending } = useSession();
  if (isPending || data?.user) {
    return null;
  }
  return (
    <Button
      onClick={() =>
        signInWithGithub(window.location.pathname + window.location.search)
      }
      size="sm"
      variant="outline"
    >
      <GithubIcon />
      Sign in
    </Button>
  );
}
