import type { Subscription } from "@sphynx/schema/domain/credentials";
import type { EnvironmentVariable } from "@sphynx/schema/domain/environment";
import { toast } from "sonner";
import { useDialog } from "@/lib/dialog/dialogs";
import { environmentClient } from "@/lib/environment-client";
import { removeVariableCopy } from "@/lib/settings/remove-variable-copy";
import { PLANS } from "@/lib/settings/subscription-plans";
import { useEnvironmentMutation } from "@/lib/settings/use-environment-mutation";

export const useEnvironmentActions = (
  variables: readonly EnvironmentVariable[],
  subscriptions: readonly Subscription[]
) => {
  const { open } = useDialog();
  const removeVariable = useEnvironmentMutation({
    failure: "Couldn't remove the variable",
    mutationFn: environmentClient.removeVariable,
  });
  const removeSubscription = useEnvironmentMutation({
    failure: "Couldn't disconnect the plan",
    mutationFn: environmentClient.removeSubscription,
  });

  const onAddVariables = () => open("addVariables", { existing: variables });

  const onAddSubscription = () => open("addSubscription", {});

  const onReconnect = (subscription: Subscription) =>
    open("addSubscription", { replacing: subscription });

  const onEdit = (variable: EnvironmentVariable) =>
    open("editVariable", { variable });

  const onRemove = (variable: EnvironmentVariable) =>
    open("confirm", {
      ...removeVariableCopy(variable, variables, subscriptions),
      onConfirm: () =>
        removeVariable.mutateAsync(variable.id).then(
          () => {
            toast.success(`Removed ${variable.name}`);
          },
          () => undefined
        ),
    });

  const onDisconnect = (subscription: Subscription) => {
    const { label } = PLANS[subscription.plan];

    open("confirm", {
      confirmLabel: "Disconnect",
      description:
        "Agents stop running on this plan. Runs already in progress finish first.",
      destructive: true,
      onConfirm: () =>
        removeSubscription.mutateAsync(subscription.id).then(
          () => {
            toast.success(`Disconnected ${label}`);
          },
          () => undefined
        ),
      title: `Disconnect ${label}?`,
    });
  };

  return {
    onAddSubscription,
    onAddVariables,
    onDisconnect,
    onEdit,
    onReconnect,
    onRemove,
  };
};
