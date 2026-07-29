import {
  convexClient,
  crossDomainClient,
} from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [crossDomainClient(), convexClient()],
});

export const { signIn, signOut, useSession } = authClient;
