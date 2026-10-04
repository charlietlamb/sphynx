import type { Subscription } from "@sphynx/schema/domain/credentials";
import { DropdownMenuItem } from "@sphynx/ui/components/dropdown-menu";
import { harnessPresentation } from "@sphynx/ui/components/evals/variant-presentation";
import { Badge } from "@sphynx/ui/components/ui/badge";
import { DataTableRow } from "@sphynx/ui/components/ui/data-table";
import { DestructiveMenuItem } from "@/components/layout/destructive-menu-item";
import { RowActionsMenu } from "@/components/layout/row-actions-menu";
import { LastUsedCell } from "@/components/settings/environment/last-used-cell";
import { UsedByBadges } from "@/components/settings/environment/used-by-badges";
import { scopeLabel } from "@/lib/settings/scopes";
import { PLANS } from "@/lib/settings/subscription-plans";

export function SubscriptionRow({
  onDisconnect,
  onReconnect,
  subscription,
}: {
  readonly onDisconnect: () => void;
  readonly onReconnect: () => void;
  readonly subscription: Subscription;
}) {
  const plan = PLANS[subscription.plan];
  const harness = harnessPresentation(plan.harness);
  const invalid = subscription.status === "invalid";

  return (
    <DataTableRow>
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-foreground">{plan.label}</span>
        {invalid ? (
          <Badge size="xs" variant="destructive">
            Signed out
          </Badge>
        ) : (
          <Badge size="xs" variant="outline">
            Subscription
          </Badge>
        )}
      </span>

      <UsedByBadges
        uses={[{ id: plan.harness, kind: "harness", label: harness.label }]}
      />

      {invalid ? (
        <button
          className="w-fit truncate text-left text-destructive underline-offset-2 hover:underline"
          onClick={onReconnect}
          type="button"
        >
          Reconnect to keep using it
        </button>
      ) : (
        <span className="truncate text-muted-foreground">
          {subscription.renews ? "Renews itself" : "Pasted auth file"}
        </span>
      )}

      <span className="truncate text-muted-foreground">
        {scopeLabel(subscription.scope)}
      </span>

      <LastUsedCell at={subscription.lastUsedAt} />

      <RowActionsMenu label={`Actions for ${plan.label}`}>
        <DropdownMenuItem onClick={onReconnect}>Reconnect</DropdownMenuItem>
        <DestructiveMenuItem onClick={onDisconnect}>
          Disconnect
        </DestructiveMenuItem>
      </RowActionsMenu>
    </DataTableRow>
  );
}
