import type { ChannelColor } from "@sphynx/schema/domain/channels";
import type {
  CredentialScope,
  SubscriptionPlan,
} from "@sphynx/schema/domain/credentials";
import type { EnvironmentVariable } from "@sphynx/schema/domain/environment";
import type { ConfirmDialogProps } from "@sphynx/ui/components/dialog/confirm-dialog";
import { createDialogSystem } from "@sphynx/ui/components/dialog/create-dialog-system";

export interface DialogMap {
  addSubscription: { plan?: SubscriptionPlan; scope?: CredentialScope };
  addVariables: { existing: readonly EnvironmentVariable[] };
  apiKeyCreated: { apiKey: string; name: string };
  channel: {
    color?: ChannelColor;
    name?: string;
    onSubmit: (value: { color: ChannelColor; name: string }) => void;
  };
  confirm: Omit<ConfirmDialogProps, "open" | "onClose">;
  createOrganization: Record<never, never>;
  editVariable: { variable: EnvironmentVariable };
  editVersion: {
    onCorrect: () => void;
    onEditFrom: () => void;
    servedBy: readonly string[];
    version: number;
  };
  inviteMember: Record<never, never>;
  newApiKey: { onSubmit: (name: string) => Promise<void> };
}

export const { DialogProvider, useDialog, useDialogOpen } =
  createDialogSystem<DialogMap>();
