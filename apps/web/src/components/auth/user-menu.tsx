import { SignOutIcon } from "@phosphor-icons/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@sphynx/ui/components/ui/dropdown-menu";
import { useNavigate } from "@tanstack/react-router";
import { signOut, useSession } from "@/lib/auth-client";

export function UserMenu() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  if (isPending || !session?.user) {
    return null;
  }
  const { user } = session;
  const onSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="rounded-sm outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <Avatar className="rounded-sm after:rounded-sm" size="sm">
          <AvatarImage
            alt={user.name}
            className="rounded-sm"
            src={user.image ?? undefined}
          />
          <AvatarFallback className="rounded-sm">
            {user.name[0] ?? "?"}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="font-medium text-sm">{user.name}</span>
            <span className="font-normal text-muted-foreground text-xs">
              {user.email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>
          <SignOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
