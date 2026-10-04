import type { Subscription } from "@sphynx/schema/domain/credentials";
import type { EnvironmentVariable } from "@sphynx/schema/domain/environment";
import { DateTime } from "effect";
import type { MemberSummary } from "@/components/organization/member-row";
import {
  type EnvironmentRow,
  environmentRows,
} from "@/lib/settings/environment-rows";

const NOW = Date.UTC(2026, 8, 22, 9, 0);
const DAY = 86_400_000;

const at = (daysAgo: number) => DateTime.unsafeMake(NOW - daysAgo * DAY);

const SUBSCRIPTIONS: readonly Subscription[] = [
  {
    createdAt: at(20),
    id: "sub_1",
    isDefault: true,
    lastUsedAt: at(1),
    plan: "chatgpt",
    renews: true,
    scope: "organization",
    status: "active",
  },
  {
    createdAt: at(12),
    id: "sub_2",
    isDefault: true,
    lastUsedAt: at(9),
    plan: "opencode",
    renews: false,
    scope: "personal",
    status: "invalid",
  },
];

const variable = (
  name: string,
  preview: string,
  overrides: Partial<EnvironmentVariable> = {}
): EnvironmentVariable => ({
  createdAt: at(30),
  id: `var_${name}`,
  lastUsedAt: at(2),
  name,
  preview,
  revision: 1,
  scope: "organization",
  secret: true,
  updatedAt: at(30),
  ...overrides,
});

const VARIABLES: readonly EnvironmentVariable[] = [
  variable("ANTHROPIC_API_KEY", "••••4f2a"),
  variable("OPENAI_API_KEY", "••••9Qd1", { scope: "personal" }),
  variable("AI_GATEWAY_API_KEY", "••••7c0e", { lastUsedAt: null }),
  variable("APP_BASE_URL", "https://staging.acme.dev", { secret: false }),
  variable("SEARCH_API_KEY", "••••11ab"),
];

export const ENVIRONMENT: readonly EnvironmentRow[] = environmentRows(
  SUBSCRIPTIONS,
  VARIABLES
);

export const MEMBERS = [
  {
    createdAt: new Date(NOW - 40 * DAY),
    id: "mem_1",
    role: "owner",
    user: { email: "charlie@sphynx.sh", image: null, name: "Charlie Lamb" },
  },
  {
    createdAt: new Date(NOW - 3 * DAY),
    id: "mem_2",
    role: "member",
    user: { email: "sam@sphynx.sh", image: null, name: "" },
  },
] satisfies readonly MemberSummary[];

export const KEYS = [
  { createdAt: new Date(NOW - DAY), id: "key_1", name: "CI", start: "anp_7Kq" },
  {
    createdAt: new Date(NOW - 30 * DAY),
    id: "key_2",
    name: "Local laptop",
    start: "anp_3Xw",
  },
];
