import { useAppForm } from "@sphynx/ui/hooks/use-app-form";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowRightIcon } from "@/components/icons/arrow-right-icon";
import { signIn } from "@/lib/auth-client";

const magicLinkSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

export function MagicLinkForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: { email: "" },
    validators: { onChange: magicLinkSchema },
    onSubmit: async ({ value }) => {
      try {
        const { error } = await signIn.magicLink({
          callbackURL: "/",
          email: value.email,
        });
        if (error) {
          toast.error("Couldn't send magic link", {
            description: error.message,
          });
          return;
        }
      } catch {
        toast.error("Couldn't send magic link", {
          description: "Can't reach the server. Please try again.",
        });
        return;
      }

      setSentTo(value.email);
    },
  });

  if (sentTo) {
    return (
      <p className="text-muted-foreground text-sm">
        Check your inbox. We sent a magic link to{" "}
        <span className="text-foreground">{sentTo}</span>.
      </p>
    );
  }

  return (
    <form
      className="grid gap-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.AppField name="email">
        {(field) => (
          <field.TextField
            autoComplete="email"
            label="Email"
            placeholder="you@company.com"
            type="email"
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton
          icon={<ArrowRightIcon />}
          label="Send magic link"
          loadingLabel="Sending…"
        />
      </form.AppForm>
    </form>
  );
}
