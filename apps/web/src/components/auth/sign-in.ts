import { toast } from "sonner";
import { signIn } from "@/lib/auth-client";

export async function signInWithGithub(callbackURL: string) {
  try {
    const { error } = await signIn.social({ provider: "github", callbackURL });
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
