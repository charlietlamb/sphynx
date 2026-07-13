"use client";

import {
  ArrowRight,
  Bell,
  Cube,
  GearSix,
  type Icon,
  Lightning,
  Palette,
  Sparkle,
  SquaresFour,
} from "@phosphor-icons/react";
import { ThemeToggle } from "@sphynx/ui/components/theme-toggle";

import { Badge } from "@sphynx/ui/components/ui/badge";
import { Button } from "@sphynx/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@sphynx/ui/components/ui/card";
import { Input } from "@sphynx/ui/components/ui/input";
import { Label } from "@sphynx/ui/components/ui/label";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@sphynx/ui/components/ui/progress";
import { Separator } from "@sphynx/ui/components/ui/separator";
import { Switch } from "@sphynx/ui/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@sphynx/ui/components/ui/tabs";
import type { ComponentProps } from "react";

type ButtonVariant = ComponentProps<typeof Button>["variant"];
type BadgeVariant = ComponentProps<typeof Badge>["variant"];

const NAV_LINKS = ["Components", "Tokens", "Patterns", "Changelog"] as const;

const BUTTON_VARIANTS: { label: string; variant: ButtonVariant }[] = [
  { label: "Primary", variant: "default" },
  { label: "Secondary", variant: "secondary" },
  { label: "Outline", variant: "outline" },
  { label: "Ghost", variant: "ghost" },
  { label: "Destructive", variant: "destructive" },
];

const BADGE_VARIANTS: { label: string; variant: BadgeVariant }[] = [
  { label: "Default", variant: "default" },
  { label: "Secondary", variant: "secondary" },
  { label: "Outline", variant: "outline" },
  { label: "Alert", variant: "destructive" },
];

const PANEL_TABS: { value: string; label: string; icon: Icon; body: string }[] =
  [
    {
      value: "components",
      label: "Components",
      icon: Cube,
      body: "Composable primitives with sensible defaults and full keyboard support.",
    },
    {
      value: "tokens",
      label: "Tokens",
      icon: Palette,
      body: "Color, radius, and spacing all flow from one set of CSS variables.",
    },
    {
      value: "motion",
      label: "Motion",
      icon: Lightning,
      body: "Calm, purposeful transitions that stay under 200ms and out of the way.",
    },
  ];

const NOTIFICATION_ROWS: { id: string; label: string; on: boolean }[] = [
  { id: "preview-updates", label: "Product updates", on: true },
  { id: "preview-mentions", label: "Mentions", on: true },
  { id: "preview-digest", label: "Weekly digest", on: false },
];

const PROGRESS_ROWS: { label: string; value: number }[] = [
  { label: "Tokens mapped", value: 92 },
  { label: "Components shipped", value: 64 },
];

const STATS: { value: string; label: string; caption: string }[] = [
  {
    value: "40+",
    label: "Primitives",
    caption: "Accessible, themeable, copy-paste ready.",
  },
  {
    value: "2",
    label: "Themes",
    caption: "Light and dark driven entirely by tokens.",
  },
  {
    value: "100%",
    label: "Type-safe",
    caption: "Strict TypeScript across every component.",
  },
];

function DesignSystemPreview() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 pb-24 md:px-6">
      <SiteNav />
      <Hero />
      <FeaturePanel />
      <PrimitivesGrid />
      <Stats />
      <SiteFooter />
    </div>
  );
}

function SiteNav() {
  return (
    <header className="sticky top-4 z-10 mx-auto mt-4 flex w-full max-w-3xl items-center justify-between gap-4 rounded-full border border-border bg-background/80 py-2 pr-2 pl-4 shadow-sm backdrop-blur-md">
      <a className="flex items-center gap-2 font-semibold" href="#top">
        <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
          <SquaresFour weight="fill" />
        </span>
        Sphynx
      </a>
      <nav className="hidden items-center gap-1 md:flex">
        {NAV_LINKS.map((link) => (
          <Button key={link} size="sm" variant="ghost">
            {link}
          </Button>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button size="sm">Get started</Button>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section
      className="motion-safe:fade-in motion-safe:slide-in-from-bottom-3 relative flex flex-col items-center gap-6 pt-10 text-center motion-safe:animate-in motion-safe:duration-700"
      id="top"
    >
      <div
        aria-hidden
        className="absolute top-[-6rem] left-1/2 -z-10 h-72 w-[44rem] max-w-full -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_30%,transparent),transparent)] blur-2xl"
      />
      <Badge variant="outline">
        <Sparkle weight="fill" />
        Design system v1
      </Badge>
      <h1 className="max-w-3xl text-balance font-semibold text-4xl tracking-tight md:text-6xl">
        The interface kit behind Sphynx
      </h1>
      <p className="max-w-xl text-pretty text-base text-muted-foreground md:text-lg">
        A small, opinionated set of accessible primitives. Clean by default,
        themeable to the core, and built to feel right in light and dark.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button size="lg">
          Browse components
          <ArrowRight data-icon="inline-end" weight="bold" />
        </Button>
        <Button size="lg" variant="outline">
          Read the docs
        </Button>
      </div>
    </section>
  );
}

function FeaturePanel() {
  return (
    <Card className="overflow-hidden border-0 bg-primary text-primary-foreground shadow-xl">
      <CardContent className="relative grid gap-10 p-6 md:grid-cols-[1fr_1fr] md:p-12">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(110%_110%_at_90%_0%,color-mix(in_oklab,var(--chart-2)_45%,transparent),transparent_55%)]"
        />
        <div className="relative flex flex-col items-start gap-6">
          <Badge
            className="border-white/25 bg-white/15 text-white"
            variant="outline"
          >
            <Lightning weight="fill" />
            One source of truth
          </Badge>
          <h2 className="text-balance font-semibold text-3xl tracking-tight md:text-4xl">
            Change a token, the whole system follows
          </h2>
          <p className="max-w-sm text-pretty text-primary-foreground/80">
            Every surface, control, and accent reads from the same variables.
            Recolor once and the entire kit stays in tune.
          </p>
          <Tabs className="w-full" defaultValue="components">
            <TabsList className="w-full border-white/15 bg-white/10 text-white/70">
              {PANEL_TABS.map(({ value, label, icon: TabIcon }) => (
                <TabsTrigger key={value} value={value}>
                  <TabIcon weight="fill" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            {PANEL_TABS.map(({ value, body }) => (
              <TabsContent
                className="text-primary-foreground/80 text-sm/relaxed"
                key={value}
                value={value}
              >
                {body}
              </TabsContent>
            ))}
          </Tabs>
        </div>
        <div className="relative">
          <Card className="text-card-foreground shadow-2xl">
            <CardHeader>
              <CardDescription>Composed from primitives</CardDescription>
              <CardTitle>Notifications</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {NOTIFICATION_ROWS.map(({ id, label, on }) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
                  key={id}
                >
                  <Label htmlFor={id}>{label}</Label>
                  <Switch defaultChecked={on} id={id} />
                </div>
              ))}
            </CardContent>
            <CardFooter className="justify-between">
              <Badge variant="secondary">Autosaved</Badge>
              <Button size="sm">
                Save changes
                <ArrowRight data-icon="inline-end" weight="bold" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}

function PrimitivesGrid() {
  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="font-medium text-muted-foreground text-sm">
          The building blocks
        </span>
        <h2 className="font-semibold text-3xl tracking-tight">Primitives</h2>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Buttons</CardTitle>
            <CardDescription>
              Five variants, three sizes, icon-ready.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-3">
              {BUTTON_VARIANTS.map(({ label, variant }) => (
                <Button key={label} variant={variant}>
                  {label}
                </Button>
              ))}
            </div>
            <Separator />
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button>Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" variant="outline">
                <GearSix />
              </Button>
              <Button size="icon" variant="outline">
                <Bell />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Badges</CardTitle>
            <CardDescription>
              Compact status and metadata pills.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            {BADGE_VARIANTS.map(({ label, variant }) => (
              <Badge key={label} variant={variant}>
                {label}
              </Badge>
            ))}
            <Badge>
              <Sparkle weight="fill" />
              With icon
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
            <CardDescription>Labelled, value-aware indicators.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 pt-1">
            {PROGRESS_ROWS.map(({ label, value }) => (
              <Progress key={label} value={value}>
                <ProgressLabel>{label}</ProgressLabel>
                <ProgressValue />
              </Progress>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
            <CardDescription>
              Form controls with consistent focus states.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="preview-email">Email</Label>
              <Input
                id="preview-email"
                placeholder="you@example.com"
                type="email"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="preview-toggle">Email notifications</Label>
              <Switch defaultChecked id="preview-toggle" />
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="grid gap-6 md:grid-cols-3">
      {STATS.map(({ value, label, caption }) => (
        <Card key={label}>
          <CardHeader>
            <CardDescription>{label}</CardDescription>
            <span className="font-semibold text-4xl tabular-nums tracking-tight">
              {value}
            </span>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm/relaxed">
            {caption}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="flex flex-col items-center gap-2 border-border border-t pt-8 text-center text-muted-foreground text-sm">
      <span className="flex items-center gap-2 font-medium text-foreground">
        <SquaresFour weight="fill" />
        Sphynx UI
      </span>
      <span>Built with Base UI, Tailwind, and a single set of tokens.</span>
    </footer>
  );
}

export { DesignSystemPreview };
