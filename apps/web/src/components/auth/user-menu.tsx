import { SignOutIcon } from "@phosphor-icons/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import { buttonVariants } from "@sphynx/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@sphynx/ui/components/ui/dropdown-menu";
import { Skeleton } from "@sphynx/ui/components/ui/skeleton";
import { cn } from "@sphynx/ui/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { signOut, useSession } from "@/lib/auth-client";

export function UserMenu() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  if (isPending) {
    return <Skeleton className="size-[1.875rem] rounded-md" />;
  }
  if (!session?.user) {
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
        className={cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "overflow-hidden p-0"
        )}
      >
        <Avatar className="size-full rounded-md after:rounded-md">
          <AvatarImage
            alt={user.name}
            className="rounded-md"
            src={user.image ?? undefined}
          />
          <AvatarFallback className="rounded-md">
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
