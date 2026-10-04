import { CircleNotchIcon } from "@phosphor-icons/react";
import type {
  CredentialScope,
  SubscriptionPlan,
} from "@sphynx/schema/domain/credentials";
import { BaseDialog } from "@sphynx/ui/components/dialog/base-dialog";
import { LabelledSelect } from "@sphynx/ui/components/form/labelled-select";
import { ShortcutButton } from "@sphynx/ui/components/ui/shortcut-button";
import { SPIN } from "@sphynx/ui/lib/utils";
import { useState } from "react";
import { DeviceChallenge } from "@/components/settings/device-challenge";
import { AuthFileField } from "@/components/settings/environment/auth-file-field";
import { PlanPicker } from "@/components/settings/environment/plan-picker";
import { SubscriptionConnected } from "@/components/settings/environment/subscription-connected";
import { useDialog, useDialogOpen } from "@/lib/dialog/dialogs";
import { environmentClient } from "@/lib/environment-client";
import { SCOPE_OPTIONS, scopeOf } from "@/lib/settings/scopes";
import { PLANS } from "@/lib/settings/subscription-plans";
import { useChatGptLogin } from "@/lib/settings/use-chatgpt-login";
import { useEnvironmentMutation } from "@/lib/settings/use-environment-mutation";

type Step = "authFile" | "choose" | "connected";

export function AddSubscriptionDialog({
  plan: reconnecting,
  scope: initialScope,
}: {
  readonly plan?: SubscriptionPlan;
  readonly scope?: CredentialScope;
}) {
  const { close } = useDialog();
  const open = useDialogOpen("addSubscription");
  const [plan, setPlan] = useState<SubscriptionPlan>(reconnecting ?? "chatgpt");
  const [scope, setScope] = useState<string>(initialScope ?? "organization");
  const [step, setStep] = useState<Step>("choose");
  const [authJson, setAuthJson] = useState("");
  const login = useChatGptLogin(() => setStep("connected"));
  const add = useEnvironmentMutation({
    failure: "Couldn't add the subscription",
    mutationFn: environmentClient.addSubscription,
  });
  const copy = PLANS[plan];

  const proceed = () =>
    plan === "chatgpt"
      ? login.start({ scope: scopeOf(scope) })
      : setStep("authFile");

  const submitAuthFile = () => {
    if (plan !== "chatgpt") {
      add.mutate(
        { authJson: authJson.trim(), plan, scope: scopeOf(scope) },
        { onSuccess: () => setStep("connected") }
      );
    }
  };

  if (step === "connected") {
    return (
      <BaseDialog onClose={close} open={open} title={copy.connected}>
        <SubscriptionConnected message={copy.ready} onDone={close} />
      </BaseDialog>
    );
  }

  if (login.challenge !== null) {
    return (
      <BaseDialog
        description="Enter this code on ChatGPT. This window finishes on its own."
        onClose={close}
        open={open}
        title="Sign in to ChatGPT"
      >
        <DeviceChallenge challenge={login.challenge} />
        <p className="flex items-center gap-2 text-muted-foreground text-xs">
          <CircleNotchIcon aria-hidden="true" className={`size-3.5 ${SPIN}`} />
          Waiting for ChatGPT…
        </p>
      </BaseDialog>
    );
  }

  if (step === "authFile" && copy.authFileCommand !== null) {
    return (
      <BaseDialog
        description="Paste the auth file from a machine where you signed in."
        onClose={close}
        open={open}
        title={`Add ${copy.label}`}
      >
        <AuthFileField
          command={copy.authFileCommand}
          onChange={setAuthJson}
          value={authJson}
        />
        <ShortcutButton
          disabled={authJson.trim().length < 2 || add.isPending}
          metaShortcut="enter"
          onClick={submitAuthFile}
          size="lg"
          type="button"
        >
          {add.isPending ? "Adding…" : "Add subscription"}
        </ShortcutButton>
      </BaseDialog>
    );
  }

  return (
    <BaseDialog
      description={
        reconnecting === undefined
          ? "Run agents on a plan you already pay for."
          : "Sign in again so agents can keep running on this plan."
      }
      onClose={close}
      open={open}
      title={
        reconnecting === undefined
          ? "Add subscription"
          : `Reconnect ${PLANS[reconnecting].label}`
      }
    >
      <PlanPicker onChange={setPlan} value={plan} />
      <LabelledSelect
        id="subscription-scope"
        label="Available to"
        onChange={setScope}
        options={SCOPE_OPTIONS}
        value={scope}
      />
      <ShortcutButton
        disabled={login.starting}
        metaShortcut="enter"
        onClick={proceed}
        size="lg"
        type="button"
      >
        {plan === "chatgpt" ? "Continue with ChatGPT" : "Continue"}
      </ShortcutButton>
    </BaseDialog>
  );
}
