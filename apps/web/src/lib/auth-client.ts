import {
  convexClient,
  crossDomainClient,
} from "@convex-dev/better-auth/client/plugins";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [crossDomainClient(), organizationClient(), convexClient()],
});

export const { signIn, signOut, useSession } = authClient;
