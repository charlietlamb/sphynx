"use client";

import { Card, CardContent, CardFooter } from "@sphynx/ui/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@sphynx/ui/components/ui/chart";
import { Separator } from "@sphynx/ui/components/ui/separator";
import { Label, Pie, PieChart } from "recharts";

const chartData = [
  { name: "saved", value: 24_000, fill: "var(--color-saved)" },
  { name: "remaining", value: 6000, fill: "var(--color-remaining)" },
];

const chartConfig = {
  saved: {
    label: "Saved",
    color: "var(--chart-2)",
  },
  remaining: {
    label: "Remaining",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function SavingsProgress() {
  return (
    <Card>
      <CardContent>
        <ChartContainer
          className="mx-auto aspect-square max-h-[220px]"
          config={chartConfig}
        >
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent hideLabel />}
              cursor={false}
            />
            <Pie
              data={chartData}
              dataKey="value"
              endAngle={-270}
              innerRadius={70}
              nameKey="name"
              outerRadius={95}
              startAngle={90}
              strokeWidth={0}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        dominantBaseline="middle"
                        textAnchor="middle"
                        x={viewBox.cx}
                        y={viewBox.cy}
                      >
                        <tspan
                          className="fill-foreground font-bold text-2xl"
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) - 12}
                        >
                          $24,000
                        </tspan>
                        <tspan
                          className="fill-muted-foreground text-xs"
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 12}
                        >
                          80% of $30,000
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-0">
        <div className="flex w-full items-center justify-between py-3">
          <span className="text-muted-foreground text-sm">
            Projected Finish
          </span>
          <span className="font-semibold text-sm">October 2024</span>
        </div>
        <Separator />
        <div className="flex w-full items-center justify-between py-3">
          <span className="text-muted-foreground text-sm">Monthly Average</span>
          <span className="font-semibold text-sm tabular-nums">$1,250</span>
        </div>
        <Separator />
        <div className="flex w-full items-center justify-between py-3">
          <span className="text-muted-foreground text-sm">Top Contributor</span>
          <span className="font-semibold text-sm">Auto-Transfer</span>
        </div>
      </CardFooter>
    </Card>
  );
}
