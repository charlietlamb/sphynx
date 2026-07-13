"use client";

import { IconPlaceholder } from "@sphynx/ui/components/blocks/preview-02/components/icon-placeholder";

import { Button } from "@sphynx/ui/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@sphynx/ui/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@sphynx/ui/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@sphynx/ui/components/ui/table";

export function RecentTransactions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardDescription>Your latest account activity.</CardDescription>
        <CardAction>
          <Button size="sm" variant="outline">
            View All
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="w-10">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <IconPlaceholder
                    className="size-4 shrink-0"
                    hugeicons="CoffeeIcon"
                    lucide="CoffeeIcon"
                    phosphor="CoffeeIcon"
                    remixicon="RiCupLine"
                    tabler="IconCoffee"
                  />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">Blue Bottle Coffee</span>
                  <span className="text-muted-foreground text-sm">
                    Food & Drink
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                Today, 10:24 AM
              </TableCell>
              <TableCell className="text-right">
                <span className="font-semibold text-sm tabular-nums">
                  -$6.50
                </span>
              </TableCell>
              <TableCell className="w-8">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button size="icon-sm" variant="ghost" />}
                  >
                    <IconPlaceholder
                      hugeicons="MoreVerticalCircle01Icon"
                      lucide="MoreHorizontalIcon"
                      phosphor="DotsThreeIcon"
                      remixicon="RiMore2Line"
                      tabler="IconDotsVertical"
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View details</DropdownMenuItem>
                    <DropdownMenuItem>Add note</DropdownMenuItem>
                    <DropdownMenuItem>Categorize</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Dispute</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="w-10">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <IconPlaceholder
                    className="size-4 shrink-0"
                    hugeicons="ShoppingCart01Icon"
                    lucide="ShoppingCartIcon"
                    phosphor="ShoppingCartIcon"
                    remixicon="RiShoppingCartLine"
                    tabler="IconShoppingCart"
                  />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">Whole Foods Market</span>
                  <span className="text-muted-foreground text-sm">
                    Groceries
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                Yesterday
              </TableCell>
              <TableCell className="text-right">
                <span className="font-semibold text-sm tabular-nums">
                  -$142.30
                </span>
              </TableCell>
              <TableCell className="w-8">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button size="icon-sm" variant="ghost" />}
                  >
                    <IconPlaceholder
                      hugeicons="MoreVerticalCircle01Icon"
                      lucide="MoreHorizontalIcon"
                      phosphor="DotsThreeIcon"
                      remixicon="RiMore2Line"
                      tabler="IconDotsVertical"
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View details</DropdownMenuItem>
                    <DropdownMenuItem>Add note</DropdownMenuItem>
                    <DropdownMenuItem>Categorize</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Dispute</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="w-10">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <IconPlaceholder
                    className="size-4 shrink-0"
                    hugeicons="Wallet01Icon"
                    lucide="WalletIcon"
                    phosphor="WalletIcon"
                    remixicon="RiWalletLine"
                    tabler="IconWallet"
                  />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">Stripe Payout</span>
                  <span className="text-muted-foreground text-sm">Income</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                Oct 12
              </TableCell>
              <TableCell className="text-right">
                <span className="font-semibold text-emerald-500 text-sm tabular-nums">
                  +$4,200.00
                </span>
              </TableCell>
              <TableCell className="w-8">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button size="icon-sm" variant="ghost" />}
                  >
                    <IconPlaceholder
                      hugeicons="MoreVerticalCircle01Icon"
                      lucide="MoreHorizontalIcon"
                      phosphor="DotsThreeIcon"
                      remixicon="RiMore2Line"
                      tabler="IconDotsVertical"
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View details</DropdownMenuItem>
                    <DropdownMenuItem>Add note</DropdownMenuItem>
                    <DropdownMenuItem>Categorize</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Dispute</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="w-10">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <IconPlaceholder
                    className="size-4 shrink-0"
                    hugeicons="Car01Icon"
                    lucide="CarIcon"
                    phosphor="CarIcon"
                    remixicon="RiCarLine"
                    tabler="IconCar"
                  />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">Uber Technologies</span>
                  <span className="text-muted-foreground text-sm">
                    Transport
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                Oct 11
              </TableCell>
              <TableCell className="text-right">
                <span className="font-semibold text-sm tabular-nums">
                  -$24.10
                </span>
              </TableCell>
              <TableCell className="w-8">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button size="icon-sm" variant="ghost" />}
                  >
                    <IconPlaceholder
                      hugeicons="MoreVerticalCircle01Icon"
                      lucide="MoreHorizontalIcon"
                      phosphor="DotsThreeIcon"
                      remixicon="RiMore2Line"
                      tabler="IconDotsVertical"
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View details</DropdownMenuItem>
                    <DropdownMenuItem>Add note</DropdownMenuItem>
                    <DropdownMenuItem>Categorize</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Dispute</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="w-10">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <IconPlaceholder
                    className="size-4 shrink-0"
                    hugeicons="Tv01Icon"
                    lucide="TvIcon"
                    phosphor="TelevisionIcon"
                    remixicon="RiTvLine"
                    tabler="IconDeviceTv"
                  />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">Netflix Subscription</span>
                  <span className="text-muted-foreground text-sm">
                    Entertainment
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                Oct 10
              </TableCell>
              <TableCell className="text-right">
                <span className="font-semibold text-sm tabular-nums">
                  -$19.99
                </span>
              </TableCell>
              <TableCell className="w-8">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button size="icon-sm" variant="ghost" />}
                  >
                    <IconPlaceholder
                      hugeicons="MoreVerticalCircle01Icon"
                      lucide="MoreHorizontalIcon"
                      phosphor="DotsThreeIcon"
                      remixicon="RiMore2Line"
                      tabler="IconDotsVertical"
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View details</DropdownMenuItem>
                    <DropdownMenuItem>Add note</DropdownMenuItem>
                    <DropdownMenuItem>Categorize</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Dispute</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
