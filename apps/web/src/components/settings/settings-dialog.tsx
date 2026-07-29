import {
  GearIcon,
  GitMergeIcon,
  KeyboardIcon,
  KeyIcon,
  PaletteIcon,
} from "@phosphor-icons/react";
import { Button } from "@sphynx/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@sphynx/ui/components/ui/dialog";
import { useMemo, useState } from "react";
import { useRegisterCommands } from "@/components/command-palette/command-palette-context";
import { SettingsAccess } from "@/components/settings/settings-access";
import { SettingsActions } from "@/components/settings/settings-actions";
import { SettingsAppearance } from "@/components/settings/settings-appearance";
import { SettingsKeyboard } from "@/components/settings/settings-keyboard";

const SECTIONS = [
  {
    id: "appearance",
    label: "Appearance",
    description: "How Sphynx and your diffs look.",
    icon: PaletteIcon,
    content: SettingsAppearance,
  },
  {
    id: "actions",
    label: "Actions",
    description: "What happens when you merge or block.",
    icon: GitMergeIcon,
    content: SettingsActions,
  },
  {
    id: "keyboard",
    label: "Keyboard",
    description: "Everything works without a mouse.",
    icon: KeyboardIcon,
    content: SettingsKeyboard,
  },
  {
    id: "access",
    label: "Access",
    description: "What Sphynx can reach on GitHub.",
    icon: KeyIcon,
    content: SettingsAccess,
  },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [sectionId, setSectionId] = useState<SectionId>("appearance");
  useRegisterCommands(
    useMemo(
      () => ({
        groups: [
          {
            id: "preferences",
            label: "Preferences",
            commands: [
              {
                id: "open-settings",
                label: "Open settings",
                iconKey: "settings" as const,
                run: () => setOpen(true),
              },
            ],
          },
        ],
      }),
      []
    )
  );
  const section =
    SECTIONS.find((candidate) => candidate.id === sectionId) ?? SECTIONS[0];
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button aria-label="Settings" size="icon" variant="outline">
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
        <div className="flex min-h-0 items-start">
          <aside className="hidden w-44 self-stretch border-border border-r p-2 md:block">
            <p className="px-2 pt-2 pb-1 font-medium text-sm">Settings</p>
            <nav className="grid gap-1">
              {SECTIONS.map((candidate) => (
                <Button
                  className="justify-start text-muted-foreground data-active:bg-accent data-active:text-foreground"
                  data-active={candidate.id === sectionId ? "true" : undefined}
                  key={candidate.id}
                  onClick={() => setSectionId(candidate.id)}
                  size="sm"
                  variant="ghost"
                >
                  <candidate.icon weight="fill" />
                  {candidate.label}
                </Button>
              ))}
            </nav>
          </aside>
          <main className="flex h-96 min-w-0 flex-1 flex-col">
            <header className="border-border border-b px-5 pt-4 pb-3">
              <h2 className="font-medium text-sm">{section.label}</h2>
              <p className="text-muted-foreground text-xs">
                {section.description}
              </p>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <section.content />
            </div>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}
