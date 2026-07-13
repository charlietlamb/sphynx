import { account } from "./schema/auth/accounts";
import { invitation } from "./schema/auth/invitations";
import { member } from "./schema/auth/members";
import { organization } from "./schema/auth/organizations";
import { session } from "./schema/auth/sessions";
import { user } from "./schema/auth/users";
import { verification } from "./schema/auth/verifications";

export { account } from "./schema/auth/accounts";
export { invitation } from "./schema/auth/invitations";
export { member } from "./schema/auth/members";
export { organization } from "./schema/auth/organizations";
export { session } from "./schema/auth/sessions";
export { user } from "./schema/auth/users";
export { verification } from "./schema/auth/verifications";

export const schema = {
  account,
  invitation,
  member,
  organization,
  session,
  user,
  verification,
};
