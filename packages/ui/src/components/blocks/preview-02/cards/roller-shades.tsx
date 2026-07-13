"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@sphynx/ui/components/ui/card";
import { Slider } from "@sphynx/ui/components/ui/slider";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@sphynx/ui/components/ui/toggle-group";
import * as React from "react";

export function RollerShades() {
  const [position, setPosition] = React.useState([50]);

  const preset =
    position[0] <= 10 ? "open" : position[0] >= 90 ? "closed" : "half";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Living Room</CardTitle>
        <CardDescription>Roller Shades</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex h-32 flex-col overflow-hidden rounded-lg border bg-muted">
          <div
            className="bg-muted-foreground transition-all duration-300"
            style={{ height: `${position[0]}%` }}
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Open
          </span>
          <Slider
            className="flex-1"
            max={100}
            onValueChange={(value) =>
              setPosition(Array.isArray(value) ? [...value] : [value])
            }
            value={position}
          />
          <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Close
          </span>
        </div>
      </CardContent>
      <CardFooter>
        <ToggleGroup
          className="w-full"
          onValueChange={(value) => {
            const v = value[0];
            if (v === "open") {
              setPosition([0]);
            }
            if (v === "half") {
              setPosition([50]);
            }
            if (v === "closed") {
              setPosition([100]);
            }
          }}
          spacing={1}
          value={[preset]}
          variant="outline"
        >
          <ToggleGroupItem className="flex-1" value="open">
            Open
          </ToggleGroupItem>
          <ToggleGroupItem className="flex-1" value="half">
            Half
          </ToggleGroupItem>
          <ToggleGroupItem className="flex-1" value="closed">
            Closed
          </ToggleGroupItem>
        </ToggleGroup>
      </CardFooter>
    </Card>
  );
}
