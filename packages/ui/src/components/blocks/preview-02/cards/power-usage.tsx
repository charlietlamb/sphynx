"use client";

import { useDesignSystemSearchParams } from "@sphynx/ui/components/blocks/preview-02/lib/search-params";

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
import { Progress } from "@sphynx/ui/components/ui/progress";
import { Separator } from "@sphynx/ui/components/ui/separator";
import { Bar, BarChart, XAxis } from "recharts";

const chartData = [
  { hour: "6a", usage: 1.2 },
  { hour: "8a", usage: 2.8 },
  { hour: "10a", usage: 3.1 },
  { hour: "12p", usage: 2.4 },
  { hour: "2p", usage: 3.4 },
  { hour: "4p", usage: 2.9 },
  { hour: "6p", usage: 3.8 },
  { hour: "8p", usage: 3.2 },
];

const chartConfig = {
  usage: {
    label: "Usage (kW)",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function PowerUsage() {
  const [params] = useDesignSystemSearchParams();
  const isRounded = !["lyra", "sera"].includes(params.style);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Power Usage</CardTitle>
        <CardDescription>Whole Home</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ChartContainer className="h-[140px] w-full" config={chartConfig}>
          <BarChart
            data={chartData}
            margin={{ left: 0, right: 0, top: 4, bottom: 0 }}
          >
            <XAxis
              axisLine={false}
              className="text-xs"
              dataKey="hour"
              tickLine={false}
              tickMargin={6}
            />
            <ChartTooltip
              content={<ChartTooltipContent hideLabel />}
              cursor={false}
            />
            <Bar
              dataKey="usage"
              fill="var(--color-usage)"
              radius={isRounded ? [4, 4, 0, 0] : 0}
            />
          </BarChart>
        </ChartContainer>
        <Separator />
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground text-sm">
              Currently Using
            </span>
            <span className="font-semibold text-lg tabular-nums">3.4 kW</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground text-sm">Solar Gen</span>
            <span className="font-semibold text-chart-1 text-lg tabular-nums">
              +1.2 kW
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-1">
        <span className="text-muted-foreground text-sm">Battery Level</span>
        <div className="flex w-full items-center gap-2">
          <Progress className="flex-1" value={85} />
          <span className="font-medium text-sm tabular-nums">85%</span>
        </div>
      </CardFooter>
    </Card>
  );
}
