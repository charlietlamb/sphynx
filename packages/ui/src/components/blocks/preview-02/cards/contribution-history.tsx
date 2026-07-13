"use client";

import { useDesignSystemSearchParams } from "@sphynx/ui/components/blocks/preview-02/lib/search-params";
import { Button } from "@sphynx/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@sphynx/ui/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@sphynx/ui/components/ui/chart";
import {
  Item,
  ItemContent,
  ItemDescription,
} from "@sphynx/ui/components/ui/item";
import { Bar, BarChart, XAxis } from "recharts";

const chartData = [
  { month: "Dec", amount: 800 },
  { month: "Jan", amount: 1100 },
  { month: "Feb", amount: 900 },
  { month: "Mar", amount: 1300 },
  { month: "Apr", amount: 750 },
  { month: "May", amount: 1400 },
];

const chartConfig = {
  amount: {
    label: "Contribution",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function ContributionHistory() {
  const [params] = useDesignSystemSearchParams();
  const isRounded = !["lyra", "sera"].includes(params.style);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contribution History</CardTitle>
        <CardDescription className="text-xs">
          Last 6 months of activity
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer className="h-[140px] w-full" config={chartConfig}>
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 0, right: 0, top: 8, bottom: 0 }}
          >
            <XAxis
              axisLine={false}
              dataKey="month"
              tickLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              content={<ChartTooltipContent className="min-w-40" hideLabel />}
              cursor={false}
            />
            <Bar
              dataKey="amount"
              fill="var(--color-amount, var(--chart-1))"
              maxBarSize={40}
              radius={isRounded ? [6, 6, 0, 0] : 0}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardContent>
        <div className="grid w-full grid-cols-1 gap-2 md:grid-cols-2">
          <Item className="flex-col items-stretch" variant="muted">
            <ItemContent className="gap-0.5">
              <ItemDescription className="font-medium text-muted-foreground text-xs">
                Upcoming
              </ItemDescription>
              <span className="cn-font-heading font-semibold text-base">
                May 25, 2024
              </span>
              <span className="text-muted-foreground text-xs">
                $1,000 scheduled
              </span>
            </ItemContent>
          </Item>
          <Item className="flex-col items-stretch" variant="muted">
            <ItemContent className="gap-0.5">
              <ItemDescription className="font-medium text-muted-foreground text-xs">
                Auto-Save Plan
              </ItemDescription>
              <span className="cn-font-heading font-semibold text-base">
                Accelerated
              </span>
              <span className="text-muted-foreground text-xs">
                Recurring weekly
              </span>
            </ItemContent>
          </Item>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">View Full Report</Button>
      </CardFooter>
    </Card>
  );
}
