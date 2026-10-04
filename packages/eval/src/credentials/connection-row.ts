import type { credentialConnection } from "@sphynx/db/schema/credentials/connections";
import {
  Subscription,
  type SubscriptionPlan,
} from "@sphynx/schema/domain/credentials";
import { Option, Schema } from "effect";
import { timestamp } from "../repositories/run-view";

export type ConnectionRow = typeof credentialConnection.$inferSelect;

const planOf = (row: ConnectionRow): Option.Option<SubscriptionPlan> => {
  if (row.integrationId === "codex" && row.authMethodId === "chatgpt") {
    return Option.some("chatgpt");
  }
  if (row.integrationId === "opencode" || row.integrationId === "pi") {
    return Option.some(row.integrationId);
  }
  return Option.none();
};

export const subscriptionOf = (
  row: ConnectionRow
): Option.Option<Subscription> =>
  Option.map(planOf(row), (plan) =>
    Schema.validateSync(Subscription)({
      createdAt: timestamp(row.createdAt),
      id: row.id,
      isDefault: row.isDefault,
      lastUsedAt: timestamp(row.lastUsedAt),
      plan,
      renews: plan === "chatgpt",
      scope: row.scope,
      status: row.status,
    })
  );
