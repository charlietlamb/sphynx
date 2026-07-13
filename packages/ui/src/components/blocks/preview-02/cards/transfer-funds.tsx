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
import { Field, FieldGroup, FieldLabel } from "@sphynx/ui/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@sphynx/ui/components/ui/input-group";
import { Item, ItemContent } from "@sphynx/ui/components/ui/item";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sphynx/ui/components/ui/select";
import { Separator } from "@sphynx/ui/components/ui/separator";

const FROM_ACCOUNTS = [
  { label: "Main Checking (··8402) — $12,450.00", value: "checking" },
  { label: "Business (··7731) — $8,920.00", value: "business" },
];

const TO_ACCOUNTS = [
  { label: "High Yield Savings (··1192) — $42,100.00", value: "savings" },
  { label: "Investment (··3349) — $18,200.00", value: "investment" },
];

export function TransferFunds() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transfer Funds</CardTitle>
        <CardDescription>
          Move money between your connected accounts.
        </CardDescription>
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
            <FieldLabel htmlFor="transfer-amount">
              Amount to Transfer
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>$</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput defaultValue="1,200.00" id="transfer-amount" />
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="from-account">From Account</FieldLabel>
            <Select defaultValue="checking" items={FROM_ACCOUNTS}>
              <SelectTrigger className="w-full" id="from-account">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {FROM_ACCOUNTS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="to-account">To Account</FieldLabel>
            <Select defaultValue="savings" items={TO_ACCOUNTS}>
              <SelectTrigger className="w-full" id="to-account">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {TO_ACCOUNTS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Item className="flex-col items-stretch" variant="muted">
            <ItemContent className="gap-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">
                  Estimated arrival
                </span>
                <span className="font-medium text-sm">Today, Apr 14</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">
                  Transaction fee
                </span>
                <span className="font-medium text-sm tabular-nums">$0.00</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">Total amount</span>
                <span className="font-semibold text-sm tabular-nums">
                  $1,200.00
                </span>
              </div>
            </ItemContent>
          </Item>
        </FieldGroup>
      </CardContent>
      <CardFooter>
        <Button className="w-full">Confirm Transfer</Button>
      </CardFooter>
    </Card>
  );
}
