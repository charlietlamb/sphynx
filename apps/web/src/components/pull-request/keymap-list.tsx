import { Kbd } from "@sphynx/ui/components/ui/kbd";
import {
  DEFAULT_KEYMAP,
  keymapHelp,
} from "@/components/pull-request/review-keymap";

const BINDINGS = [
  ...keymapHelp(DEFAULT_KEYMAP),
  { chord: "1-9", description: "Count — repeats the next motion" },
  { chord: "Esc", description: "Cancel — draft, selection, definitions" },
];

export function KeymapList() {
  return (
    <dl className="flex flex-col gap-1.5">
      {BINDINGS.map(({ chord, description }) => (
        <div className="flex items-center justify-between gap-3" key={chord}>
          <dt>
            <Kbd>{chord}</Kbd>
          </dt>
          <dd className="text-muted-foreground text-xs">{description}</dd>
        </div>
      ))}
    </dl>
  );
}
