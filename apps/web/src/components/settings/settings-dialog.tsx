import { GearIcon, KeyboardIcon, PaletteIcon } from "@phosphor-icons/react";
import { Button } from "@sphynx/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@sphynx/ui/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@sphynx/ui/components/ui/sidebar";
import { useState } from "react";
import { SettingsAppearance } from "@/components/settings/settings-appearance";
import { SettingsKeyboard } from "@/components/settings/settings-keyboard";

const SECTIONS = [
  {
    id: "appearance",
    label: "Appearance",
    description: "How Sphynx and your diffs look.",
    icon: PaletteIcon,
  },
  {
    id: "keyboard",
    label: "Keyboard",
    description: "Everything works without a mouse.",
    icon: KeyboardIcon,
  },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function SettingsDialog() {
  const [sectionId, setSectionId] = useState<SectionId>("appearance");
  const section =
    SECTIONS.find((candidate) => candidate.id === sectionId) ?? SECTIONS[0];
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button aria-label="Settings" size="icon-sm" variant="outline">
            <GearIcon className="size-[1.125rem]" />
          </Button>
        }
      />
      <DialogContent className="overflow-hidden p-0 md:max-w-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Preferences for how Sphynx looks and feels.
          </DialogDescription>
        </DialogHeader>
        <SidebarProvider className="min-h-0 items-start">
          <Sidebar
            className="hidden w-44 self-stretch border-border border-r md:flex"
            collapsible="none"
          >
            <SidebarHeader className="px-4 pt-4 pb-1">
              <p className="font-medium text-sm">Settings</p>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {SECTIONS.map((candidate) => (
                      <SidebarMenuItem key={candidate.id}>
                        <SidebarMenuButton
                          className="border border-transparent text-muted-foreground hover:bg-sidebar-accent/40 active:bg-sidebar-accent/40 data-active:border-border data-active:bg-sidebar-accent data-active:text-foreground"
                          isActive={candidate.id === sectionId}
                          onClick={() => setSectionId(candidate.id)}
                        >
                          <candidate.icon />
                          {candidate.label}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="flex h-96 min-w-0 flex-1 flex-col">
            <header className="border-border border-b px-5 pt-4 pb-3">
              <h2 className="font-medium text-sm">{section.label}</h2>
              <p className="text-muted-foreground text-xs">
                {section.description}
              </p>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {sectionId === "appearance" ? <SettingsAppearance /> : null}
              {sectionId === "keyboard" ? <SettingsKeyboard /> : null}
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
}
