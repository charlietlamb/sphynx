"use client";

import { IconPlaceholder } from "@sphynx/ui/components/blocks/preview-02/components/icon-placeholder";
import { useDesignSystemSearchParams } from "@sphynx/ui/components/blocks/preview-02/lib/search-params";
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
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@sphynx/ui/components/ui/chart";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@sphynx/ui/components/ui/item";
import { Bar, BarChart } from "recharts";

const HOLDINGS = [
  {
    name: "Vanguard VIG",
    shares: "450 Shares",
    amount: "$1,842.10",
    data: [
      { q: "Q1", value: 380 },
      { q: "Q2", value: 420 },
      { q: "Q3", value: 390 },
      { q: "Q4", value: 652 },
    ],
  },
  {
    name: "S&P 500 VOO",
    shares: "112 Shares",
    amount: "$928.40",
    data: [
      { q: "Q1", value: 180 },
      { q: "Q2", value: 210 },
      { q: "Q3", value: 320 },
      { q: "Q4", value: 218 },
    ],
  },
  {
    name: "Apple AAPL",
    shares: "85 Shares",
    amount: "$340.00",
    data: [
      { q: "Q1", value: 60 },
      { q: "Q2", value: 70 },
      { q: "Q3", value: 120 },
      { q: "Q4", value: 90 },
    ],
  },
  {
    name: "Realty Income",
    shares: "320 Shares",
    amount: "$1,139.50",
    data: [
      { q: "Q1", value: 240 },
      { q: "Q2", value: 260 },
      { q: "Q3", value: 280 },
      { q: "Q4", value: 360 },
    ],
  },
];

const miniChartConfig = {
  value: {
    label: "Dividend",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function DividendIncome() {
  const [params] = useDesignSystemSearchParams();
  const isRounded = !["lyra", "sera"].includes(params.style);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Q2 Dividend Income</CardTitle>
        <CardDescription>
          Quarterly dividend payouts across your portfolio holdings.
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
        <ItemGroup>
          {HOLDINGS.map((holding) => (
            <Item key={holding.name} variant="muted">
              <ItemContent>
                <ItemTitle>{holding.name}</ItemTitle>
                <ItemDescription>{holding.shares}</ItemDescription>
              </ItemContent>
              <ChartContainer
                className="hidden h-8 w-24 md:block"
                config={miniChartConfig}
              >
                <BarChart
                  data={holding.data}
                  margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                >
                  <ChartTooltip
                    content={<ChartTooltipContent hideLabel />}
                    cursor={false}
                  />
                  <Bar
                    dataKey="value"
                    fill="var(--color-value)"
                    radius={isRounded ? [3, 3, 0, 0] : 0}
                  />
                </BarChart>
              </ChartContainer>
              <span className="hidden font-semibold text-sm tabular-nums md:block">
                {holding.amount}
              </span>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}
