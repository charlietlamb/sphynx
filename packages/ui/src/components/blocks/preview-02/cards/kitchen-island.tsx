"use client";

import { IconPlaceholder } from "@sphynx/ui/components/blocks/preview-02/components/icon-placeholder";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@sphynx/ui/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@sphynx/ui/components/ui/item";
import { Slider } from "@sphynx/ui/components/ui/slider";
import { Switch } from "@sphynx/ui/components/ui/switch";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@sphynx/ui/components/ui/toggle-group";
import * as React from "react";

const SCENES = {
  cooking: { brightness: [90], colorTemp: [70], volume: [30], fade: [0] },
  dining: { brightness: [50], colorTemp: [40], volume: [20], fade: [60] },
  nightlight: { brightness: [15], colorTemp: [20], volume: [0], fade: [80] },
  focus: { brightness: [100], colorTemp: [85], volume: [0], fade: [0] },
} as const;

export function KitchenIsland() {
  const [enabled, setEnabled] = React.useState(true);
  const [scene, setScene] = React.useState("cooking");
  const [brightness, setBrightness] = React.useState([90]);
  const [colorTemp, setColorTemp] = React.useState([70]);
  const [volume, setVolume] = React.useState([30]);
  const [fade, setFade] = React.useState([0]);

  const handleSceneChange = (value: string) => {
    if (!value) {
      return;
    }
    setScene(value);
    const preset = SCENES[value as keyof typeof SCENES];
    setBrightness([...preset.brightness]);
    setColorTemp([...preset.colorTemp]);
    setVolume([...preset.volume]);
    setFade([...preset.fade]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kitchen Island</CardTitle>
        <CardDescription>Hue Color Ambient</CardDescription>
        <CardAction>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="sr-only">Scenes</span>
          <ToggleGroup
            className="flex-wrap"
            onValueChange={(value) => handleSceneChange(value[0] ?? "cooking")}
            spacing={1}
            value={[scene]}
            variant="outline"
          >
            <ToggleGroupItem disabled={!enabled} value="cooking">
              Cooking
            </ToggleGroupItem>
            <ToggleGroupItem disabled={!enabled} value="dining">
              Dining
            </ToggleGroupItem>
            <ToggleGroupItem disabled={!enabled} value="nightlight">
              Nightlight
            </ToggleGroupItem>
            <ToggleGroupItem disabled={!enabled} value="focus">
              Focus
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <ItemGroup>
          <Item size="sm" variant="outline">
            <ItemMedia variant="icon">
              <IconPlaceholder
                hugeicons="Sun03Icon"
                lucide="SunIcon"
                phosphor="SunIcon"
                remixicon="RiSunLine"
                tabler="IconSun"
              />
            </ItemMedia>
            <ItemContent className="flex-row items-center gap-3">
              <ItemTitle className="shrink-0">Brightness</ItemTitle>
            </ItemContent>
            <ItemActions className="flex-1">
              <Slider
                className="w-full"
                disabled={!enabled}
                max={100}
                onValueChange={(value) =>
                  setBrightness(Array.isArray(value) ? [...value] : [value])
                }
                value={brightness}
              />
            </ItemActions>
          </Item>
          <Item size="sm" variant="outline">
            <ItemMedia variant="icon">
              <IconPlaceholder
                hugeicons="ThermometerWarmIcon"
                lucide="ThermometerIcon"
                phosphor="ThermometerIcon"
                remixicon="RiThermometerLine"
                tabler="IconThermometer"
              />
            </ItemMedia>
            <ItemContent className="flex-row items-center gap-3">
              <ItemTitle className="shrink-0">Color Temp</ItemTitle>
            </ItemContent>
            <ItemActions className="flex-1">
              <Slider
                disabled={!enabled}
                max={100}
                onValueChange={(value) =>
                  setColorTemp(Array.isArray(value) ? [...value] : [value])
                }
                value={colorTemp}
              />
            </ItemActions>
          </Item>
          <Item size="sm" variant="outline">
            <ItemMedia variant="icon">
              <IconPlaceholder
                hugeicons="VolumeHighIcon"
                lucide="Volume2Icon"
                phosphor="SpeakerHighIcon"
                remixicon="RiVolumeUpLine"
                tabler="IconVolume"
              />
            </ItemMedia>
            <ItemContent className="flex-row items-center gap-3">
              <ItemTitle className="shrink-0">Volume</ItemTitle>
            </ItemContent>
            <ItemActions className="flex-1">
              <Slider
                disabled={!enabled}
                max={100}
                onValueChange={(value) =>
                  setVolume(Array.isArray(value) ? [...value] : [value])
                }
                value={volume}
              />
            </ItemActions>
          </Item>
          <Item size="sm" variant="outline">
            <ItemMedia variant="icon">
              <IconPlaceholder
                hugeicons="Clock03Icon"
                lucide="TimerIcon"
                phosphor="TimerIcon"
                remixicon="RiTimerLine"
                tabler="IconClock"
              />
            </ItemMedia>
            <ItemContent className="flex-row items-center gap-3">
              <ItemTitle className="shrink-0">Fade</ItemTitle>
            </ItemContent>
            <ItemActions className="flex-1">
              <Slider
                disabled={!enabled}
                max={100}
                onValueChange={(value) =>
                  setFade(Array.isArray(value) ? [...value] : [value])
                }
                value={fade}
              />
            </ItemActions>
          </Item>
        </ItemGroup>
      </CardContent>
    </Card>
  );
}
