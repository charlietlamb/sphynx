import { PlusIcon } from "@phosphor-icons/react";
import { Button } from "@sphynx/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { EnvironmentList } from "@/components/settings/environment/environment-list";
import { environmentQueries } from "@/lib/environment-queries";
import { environmentRows } from "@/lib/settings/environment-rows";
import { useEnvironmentActions } from "@/lib/settings/use-environment-actions";

export const Route = createFileRoute("/_authed/settings/environment")({
  component: EnvironmentPage,
  staticData: { title: "Environment" },
});

function EnvironmentPage() {
  const variables = useQuery(environmentQueries.variables());
  const subscriptions = useQuery(environmentQueries.subscriptions());
  const actions = useEnvironmentActions(
    variables.data ?? [],
    subscriptions.data ?? []
  );

  return (
    <>
      <PageHeader
        actions={
          <>
            <Button
              onClick={actions.onAddSubscription}
              size="sm"
              variant="outline"
            >
              Add subscription
            </Button>
            <Button onClick={actions.onAddVariables} size="sm">
              <PlusIcon />
              Add variable
            </Button>
          </>
        }
        description="The keys and subscriptions your evals run on."
        title="Environment"
      />
      <EnvironmentList
        error={variables.error ?? subscriptions.error}
        loading={variables.isLoading || subscriptions.isLoading}
        onDisconnect={actions.onDisconnect}
        onEdit={actions.onEdit}
        onReconnect={actions.onReconnect}
        onRemove={actions.onRemove}
        rows={environmentRows(subscriptions.data ?? [], variables.data ?? [])}
      />
    </>
  );
}
