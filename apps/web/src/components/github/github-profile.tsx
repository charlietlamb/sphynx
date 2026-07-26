import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import { cn } from "@sphynx/ui/lib/utils";

const BOT_SUFFIX = /\[bot\]$/;

const isBot = (login: string) => BOT_SUFFIX.test(login);

const profileUrl = (login: string) => `https://github.com/${login}`;

type GithubProfileSize = "xs" | "sm" | "md" | "lg";

const SIZES: Record<
  GithubProfileSize,
  { avatar: string; fallback: string; label: string }
> = {
  xs: { avatar: "size-4", fallback: "text-[8px]", label: "text-[11px]" },
  sm: { avatar: "size-5", fallback: "text-[9px]", label: "text-[12px]" },
  md: { avatar: "size-6", fallback: "text-[10px]", label: "text-[13px]" },
  lg: { avatar: "size-7", fallback: "text-[11px]", label: "text-sm" },
};

const SHAPE = {
  round: "rounded-full after:rounded-full",
  square: "rounded-[5px] after:rounded-[5px]",
} as const;

interface GithubProfileProps {
  /** Extra classes on the avatar (rings, custom sizes) — merged after the shape. */
  avatarClassName?: string;
  avatarUrl?: string | null;
  className?: string;
  labelClassName?: string;
  /** Skip the profile link even for a real user (e.g. inside another link). */
  link?: boolean;
  login: string | null;
  shape?: keyof typeof SHAPE;
  size?: GithubProfileSize;
  /** Drop the `[bot]` suffix from the shown name. */
  stripBot?: boolean;
  /** `avatar` shows only the avatar; `full` shows avatar + login. */
  variant?: "avatar" | "full";
}

type BodyProps = Required<
  Pick<GithubProfileProps, "shape" | "size" | "stripBot" | "variant">
> &
  Pick<
    GithubProfileProps,
    "avatarClassName" | "avatarUrl" | "className" | "labelClassName"
  > & { login: string };

function ProfileBody({
  avatarClassName,
  avatarUrl,
  className,
  labelClassName,
  login,
  shape,
  size,
  stripBot,
  variant,
}: BodyProps) {
  const scale = SIZES[size];
  const rounding = SHAPE[shape];
  const shown = stripBot ? login.replace(BOT_SUFFIX, "") : login;
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <Avatar
        className={cn("shrink-0", rounding, scale.avatar, avatarClassName)}
      >
        <AvatarImage
          alt={login}
          className={rounding}
          src={avatarUrl ?? undefined}
        />
        <AvatarFallback className={cn(rounding, scale.fallback)}>
          {shown[0]?.toUpperCase() ?? "?"}
        </AvatarFallback>
      </Avatar>
      {variant === "full" ? (
        <span className={cn("min-w-0 truncate", scale.label, labelClassName)}>
          {shown}
        </span>
      ) : null}
    </span>
  );
}

export function GithubProfile({
  avatarClassName,
  avatarUrl,
  className,
  labelClassName,
  link = true,
  login,
  shape = "round",
  size = "xs",
  stripBot = true,
  variant = "full",
}: GithubProfileProps) {
  if (login === null) {
    return (
      <ProfileBody
        avatarClassName={avatarClassName}
        avatarUrl={null}
        className={className}
        labelClassName={labelClassName}
        login="unknown"
        shape={shape}
        size={size}
        stripBot={false}
        variant={variant}
      />
    );
  }

  const body = (
    <ProfileBody
      avatarClassName={avatarClassName}
      avatarUrl={avatarUrl}
      className={className}
      labelClassName={labelClassName}
      login={login}
      shape={shape}
      size={size}
      stripBot={stripBot}
      variant={variant}
    />
  );

  if (!link || isBot(login)) {
    return body;
  }

  return (
    <a
      className="rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:opacity-80"
      href={profileUrl(login)}
      rel="noreferrer"
      target="_blank"
    >
      {body}
    </a>
  );
}
