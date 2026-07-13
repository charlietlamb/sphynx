import { IconPlaceholder } from "@sphynx/ui/components/blocks/preview-02/components/icon-placeholder";
import { Badge } from "@sphynx/ui/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@sphynx/ui/components/ui/card";

export function FrontDoor() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Front Door</CardTitle>
        <CardDescription>Smart Lock Pro</CardDescription>
        <CardAction>
          <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
            Locked
            <IconPlaceholder
              className="size-4"
              hugeicons="SquareLock02Icon"
              lucide="LockIcon"
              phosphor="LockKeyIcon"
              remixicon="RiLockLine"
              tabler="IconLock"
            />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,var(--border)_10px,var(--border)_11px)] bg-muted">
          <Badge className="absolute top-2 right-2" variant="destructive">
            Live
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
