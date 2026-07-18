import { Kbd } from "@sphynx/ui/components/ui/kbd";

export interface KeyBinding {
  chord: string;
  description: string;
}

export function KeymapList({ bindings }: { bindings: readonly KeyBinding[] }) {
  return (
    <dl className="flex flex-col gap-1.5">
      {bindings.map(({ chord, description }) => (
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
