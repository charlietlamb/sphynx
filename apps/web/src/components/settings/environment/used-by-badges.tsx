import { CodeIcon, ScalesIcon, UsersIcon } from "@phosphor-icons/react";
import {
  harnessPresentation,
  sandboxPresentation,
} from "@sphynx/ui/components/evals/variant-presentation";
import { Badge } from "@sphynx/ui/components/ui/badge";
import { keyOf, type UsedBy } from "@/lib/settings/variable-uses";

const iconOf = (use: UsedBy) => {
  if (use.kind === "code") {
    return CodeIcon;
  }

  if (use.kind === "judge") {
    return ScalesIcon;
  }

  if (use.kind === "simulated") {
    return UsersIcon;
  }

  return use.kind === "harness"
    ? harnessPresentation(use.id).Icon
    : sandboxPresentation(use.id).Icon;
};

export function UsedByIcon({ use }: { readonly use: UsedBy }) {
  const Icon = iconOf(use);

  return <Icon aria-hidden="true" className="size-3.5 shrink-0" />;
}

export function UsedByBadges({ uses }: { readonly uses: readonly UsedBy[] }) {
  return (
    <span className="flex min-w-0 items-center gap-1 overflow-hidden">
      {uses.map((use) => {
        const Icon = iconOf(use);

        return (
          <Badge key={keyOf(use)} size="sm" variant="secondary">
            <Icon aria-hidden="true" />
            <span
              className={use.kind === "code" ? "text-muted-foreground" : ""}
            >
              {use.label}
            </span>
          </Badge>
        );
      })}
    </span>
  );
}
