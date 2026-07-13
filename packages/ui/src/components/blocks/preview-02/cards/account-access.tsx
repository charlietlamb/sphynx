"use client";

import { IconPlaceholder } from "@sphynx/ui/components/blocks/preview-02/components/icon-placeholder";
import { Button } from "@sphynx/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@sphynx/ui/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@sphynx/ui/components/ui/field";
import { Input } from "@sphynx/ui/components/ui/input";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@sphynx/ui/components/ui/item";

export function AccountAccess() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Access</CardTitle>
        <CardDescription>
          Update your credentials or re-authenticate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email-address">Email Address</FieldLabel>
            <Input
              defaultValue="artist@studio.inc"
              id="email-address"
              type="email"
            />
          </Field>
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="current-password">
                Current Password
              </FieldLabel>
              <a
                className="font-medium text-muted-foreground text-xs uppercase tracking-wider hover:text-foreground"
                href="#"
              >
                Forgot?
              </a>
            </div>
            <Input
              defaultValue="password123"
              id="current-password"
              type="password"
            />
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter className="flex-col gap-4">
        <Button className="w-full">
          <IconPlaceholder
            hugeicons="SquareLock02Icon"
            lucide="LockKeyholeIcon"
            phosphor="LockKeyIcon"
            remixicon="RiLockLine"
            tabler="IconLock"
          />
          Update Security
        </Button>
        <Item render={<a href="#" />} variant="muted">
          <ItemMedia variant="icon">
            <IconPlaceholder
              className="text-destructive"
              hugeicons="AlertCircleIcon"
              lucide="AlertCircleIcon"
              phosphor="WarningCircleIcon"
              remixicon="RiErrorWarningLine"
              tabler="IconAlertCircle"
            />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Danger Zone</ItemTitle>
            <ItemDescription className="line-clamp-1">
              Archive account and remove catalog
            </ItemDescription>
          </ItemContent>
          <IconPlaceholder
            className="size-4"
            hugeicons="ArrowRight01Icon"
            lucide="ArrowRightIcon"
            phosphor="ArrowRightIcon"
            remixicon="RiArrowRightLine"
            tabler="IconArrowRight"
          />
        </Item>
      </CardFooter>
    </Card>
  );
}
