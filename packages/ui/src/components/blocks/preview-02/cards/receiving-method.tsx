"use client";

import { IconPlaceholder } from "@sphynx/ui/components/blocks/preview-02/components/icon-placeholder";
import { Button } from "@sphynx/ui/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@sphynx/ui/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@sphynx/ui/components/ui/field";
import { Input } from "@sphynx/ui/components/ui/input";
import {
  RadioGroup,
  RadioGroupItem,
} from "@sphynx/ui/components/ui/radio-group";

export function ReceivingMethod() {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Payout Preferences</CardDescription>
        <CardTitle>Receiving Method</CardTitle>
        <CardAction>
          <Button className="bg-muted" size="icon-sm" variant="ghost">
            <IconPlaceholder
              hugeicons="Cancel01Icon"
              lucide="XIcon"
              phosphor="XIcon"
              remixicon="RiCloseLine"
              tabler="IconX"
            />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="account-holder">
              Account Holder Name
            </FieldLabel>
            <Input
              defaultValue="Synthetic Horizons Music LLC"
              id="account-holder"
            />
          </Field>
          <FieldSet>
            <FieldLegend variant="label">Receiving Method</FieldLegend>
            <RadioGroup
              className="grid grid-cols-1 style-sera:grid-cols-1 items-start gap-3 md:grid-cols-2"
              defaultValue="bank"
            >
              <FieldLabel htmlFor="method-bank">
                <Field className="pb-2.5" orientation="horizontal">
                  <RadioGroupItem id="method-bank" value="bank" />
                  <FieldContent>
                    <FieldTitle>Bank Transfer</FieldTitle>
                    <FieldDescription>SWIFT / IBAN</FieldDescription>
                  </FieldContent>
                </Field>
              </FieldLabel>
              <FieldLabel htmlFor="method-paypal">
                <Field className="pb-2.5" orientation="horizontal">
                  <RadioGroupItem id="method-paypal" value="paypal" />
                  <FieldContent>
                    <FieldTitle>PayPal</FieldTitle>
                    <FieldDescription className="line-clamp-1">
                      Instant Payout
                    </FieldDescription>
                  </FieldContent>
                </Field>
              </FieldLabel>
            </RadioGroup>
          </FieldSet>
          <Field>
            <FieldLabel htmlFor="iban">IBAN / Account Number</FieldLabel>
            <Input id="iban" placeholder="DE89 3704 0044 ...." />
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter>
        <Button className="w-full" disabled>
          Save Payout Settings
        </Button>
      </CardFooter>
    </Card>
  );
}
