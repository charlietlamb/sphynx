import { account } from "./schema/auth/accounts";
import { githubInstallation } from "./schema/auth/github-installations";
import { invitation } from "./schema/auth/invitations";
import { member } from "./schema/auth/members";
import { organization } from "./schema/auth/organizations";
import { session } from "./schema/auth/sessions";
import { user } from "./schema/auth/users";
import { verification } from "./schema/auth/verifications";
import { findingState } from "./schema/review/finding-states";
import { pullHead } from "./schema/review/pull-head";
import { reviewCheck } from "./schema/review/review-check";
import { reviewPull } from "./schema/review/review-pull";
import { reviewRepo } from "./schema/review/review-repo";
import { reviewReviewer } from "./schema/review/review-reviewer";
import { reviewThread } from "./schema/review/review-thread";
import { stageGap, stageGapPull } from "./schema/review/stage-gap";
import { trackedRepo } from "./schema/review/tracked-repos";
import { webhookDelivery } from "./schema/review/webhook-delivery";
import { workbenchEvent } from "./schema/review/workbench-event";

export { account } from "./schema/auth/accounts";
export { githubInstallation } from "./schema/auth/github-installations";
export { invitation } from "./schema/auth/invitations";
export { member } from "./schema/auth/members";
export { organization } from "./schema/auth/organizations";
export { session } from "./schema/auth/sessions";
export { user } from "./schema/auth/users";
export { verification } from "./schema/auth/verifications";
export { findingState } from "./schema/review/finding-states";
export { pullHead } from "./schema/review/pull-head";
export { reviewCheck } from "./schema/review/review-check";
export { reviewPull } from "./schema/review/review-pull";
export { reviewRepo } from "./schema/review/review-repo";
export { reviewReviewer } from "./schema/review/review-reviewer";
export { reviewThread } from "./schema/review/review-thread";
export { stageGap, stageGapPull } from "./schema/review/stage-gap";
export { trackedRepo } from "./schema/review/tracked-repos";
export { webhookDelivery } from "./schema/review/webhook-delivery";
export { workbenchEvent } from "./schema/review/workbench-event";

export const schema = {
  account,
  invitation,
  member,
  organization,
  session,
  user,
  verification,
  githubInstallation,
  findingState,
  trackedRepo,
  reviewRepo,
  reviewPull,
  reviewReviewer,
  reviewCheck,
  reviewThread,
  stageGap,
  stageGapPull,
  workbenchEvent,
  pullHead,
  webhookDelivery,
};
