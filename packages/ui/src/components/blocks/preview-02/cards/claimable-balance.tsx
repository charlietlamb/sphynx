import { Badge } from "@sphynx/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@sphynx/ui/components/ui/card";
import { Item, ItemContent } from "@sphynx/ui/components/ui/item";
import { Separator } from "@sphynx/ui/components/ui/separator";

export function ClaimableBalance() {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="text-xs">
          Claimable Balance
        </CardDescription>
        <CardTitle className="text-2xl tabular-nums">$0.00</CardTitle>
        <Badge className="text-xs" variant="outline">
          <span className="size-1.5 rounded-full bg-yellow-500" />
          Pending Setup
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-end">
        <Item className="flex-col items-stretch" variant="muted">
          <ItemContent className="gap-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">
                Net Royalties
              </span>
              <span className="font-medium text-xs tabular-nums">$0.00</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">
                Processing Fee
              </span>
              <span className="font-medium text-xs tabular-nums">-$0.00</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">
                Total Ready to Claim
              </span>
              <span className="font-semibold text-xs tabular-nums">
                $0.00 USD
              </span>
            </div>
          </ItemContent>
        </Item>
      </CardContent>
      <CardFooter>
        <CardDescription className="text-xs">
          Balances over $10.00 are auto-eligible for distribution on the 15th
          once your bank is connected.
        </CardDescription>
      </CardFooter>
    </Card>
  );
}
