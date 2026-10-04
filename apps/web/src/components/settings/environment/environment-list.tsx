import { BracketsAngleIcon } from "@phosphor-icons/react";
import type { Subscription } from "@sphynx/schema/domain/credentials";
import type { EnvironmentVariable } from "@sphynx/schema/domain/environment";
import {
  DataTable,
  DataTableBody,
  DataTableHead,
} from "@sphynx/ui/components/ui/data-table";
import { ListState } from "@/components/layout/list-state";
import { SubscriptionRow } from "@/components/settings/environment/subscription-row";
import { VariableRow } from "@/components/settings/environment/variable-row";
import type { EnvironmentRow } from "@/lib/settings/environment-rows";
import { PLACEHOLDER_ENVIRONMENT } from "@/lib/settings/settings-placeholders";
import { ENVIRONMENT_TABLE } from "@/lib/settings/settings-tables";

export function EnvironmentList({
  error,
  loading,
  onDisconnect,
  onEdit,
  onReconnect,
  onRemove,
  rows,
}: {
  readonly error: Error | null;
  readonly loading: boolean;
  readonly onDisconnect: (subscription: Subscription) => void;
  readonly onEdit: (variable: EnvironmentVariable) => void;
  readonly onReconnect: (subscription: Subscription) => void;
  readonly onRemove: (variable: EnvironmentVariable) => void;
  readonly rows: readonly EnvironmentRow[];
}) {
  return (
    <ListState
      description="Add a key or a subscription and your evals can run."
      empty={rows.length === 0}
      error={error}
      icon={<BracketsAngleIcon />}
      loading={loading}
      title="Nothing set yet"
    >
      <div className="flex flex-col gap-3">
        <DataTable
          columns={ENVIRONMENT_TABLE.columns}
          label={ENVIRONMENT_TABLE.label}
        >
          <DataTableHead headings={ENVIRONMENT_TABLE.headings} />
          <DataTableBody>
            {(loading ? PLACEHOLDER_ENVIRONMENT : rows).map((row) =>
              row.kind === "subscription" ? (
                <SubscriptionRow
                  key={row.subscription.id}
                  onDisconnect={() => onDisconnect(row.subscription)}
                  onReconnect={() => onReconnect(row.subscription)}
                  subscription={row.subscription}
                />
              ) : (
                <VariableRow
                  key={row.variable.id}
                  onEdit={() => onEdit(row.variable)}
                  onRemove={() => onRemove(row.variable)}
                  variable={row.variable}
                />
              )
            )}
          </DataTableBody>
        </DataTable>
        <p className="px-1 text-muted-foreground text-xs">
          Known names like ANTHROPIC_API_KEY are picked up on their own. Others
          reach a run when its profile names them.
        </p>
      </div>
    </ListState>
  );
}
