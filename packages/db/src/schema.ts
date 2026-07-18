import { account } from "./schema/auth/accounts";
import { invitation } from "./schema/auth/invitations";
import { member } from "./schema/auth/members";
import { organization } from "./schema/auth/organizations";
import { session } from "./schema/auth/sessions";
import { user } from "./schema/auth/users";
import { verification } from "./schema/auth/verifications";
import { findingState } from "./schema/review/finding-states";
import { trackedRepo } from "./schema/review/tracked-repos";

export { account } from "./schema/auth/accounts";
export { invitation } from "./schema/auth/invitations";
export { member } from "./schema/auth/members";
export { organization } from "./schema/auth/organizations";
export { session } from "./schema/auth/sessions";
export { user } from "./schema/auth/users";
export { verification } from "./schema/auth/verifications";
export { findingState } from "./schema/review/finding-states";
export { trackedRepo } from "./schema/review/tracked-repos";

export const schema = {
  account,
  invitation,
  member,
  organization,
  session,
  user,
  verification,
  findingState,
  trackedRepo,
};
