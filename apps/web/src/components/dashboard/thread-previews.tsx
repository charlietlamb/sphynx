import type { QueuePull } from "@sphynx/schema/review-queue";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import { plural, stripBotSuffix } from "@/lib/claims";

export function ThreadPreviews({ pull }: { pull: QueuePull }) {
  if (pull.threadPreviews.length === 0) {
    return null;
  }
  const hidden = pull.unresolvedThreads - pull.threadPreviews.length;
  return (
    <div className="flex flex-col gap-2 border-border border-b px-5 py-4">
      <p className="font-medium text-[11px] text-muted-foreground/60">
        open threads
      </p>
      {pull.threadPreviews.map((preview) => {
        const login = preview.author
          ? stripBotSuffix(preview.author.login)
          : null;
        return (
          <div
            className="flex flex-col gap-1"
            key={`${preview.path}:${preview.body.slice(0, 40)}`}
          >
            <div className="flex items-center gap-1.5">
              <Avatar className="size-3.5 shrink-0 rounded-full">
                <AvatarImage
                  alt={login ?? "unknown"}
                  className="rounded-full"
                  src={preview.author?.avatarUrl}
                />
                <AvatarFallback className="rounded-full text-[7px]">
                  {login?.[0] ?? "?"}
                </AvatarFallback>
              </Avatar>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {login ?? "unknown"}
              </span>
              {preview.path ? (
                <span
                  className="min-w-0 truncate font-mono text-[10px] text-muted-foreground/50"
                  title={preview.path}
                >
                  {preview.path.split("/").at(-1)}
                </span>
              ) : null}
            </div>
            <p className="line-clamp-2 text-pretty text-[12px] text-muted-foreground leading-snug">
              {preview.body}
            </p>
          </div>
        );
      })}
      {hidden > 0 ? (
        <p className="text-[11px] text-muted-foreground/50">
          +{plural(hidden, "more open thread")}
        </p>
      ) : null}
    </div>
  );
}
