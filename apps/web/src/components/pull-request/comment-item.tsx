import type { ReviewComment } from "@sphynx/schema/pull-request-comments";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sphynx/ui/components/ui/avatar";
import { Badge } from "@sphynx/ui/components/ui/badge";
import { cn } from "@sphynx/ui/lib/utils";
import { CommentBody } from "@/components/pull-request/comment-body";

function commentDate(createdAt: string) {
  return new Date(createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

interface CommentItemProps {
  comment: ReviewComment;
  originalLines: readonly string[];
  topBorder: boolean;
}

export function CommentItem({
  comment,
  originalLines,
  topBorder,
}: CommentItemProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 px-3.5 py-3",
        topBorder && "border-border border-t"
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Avatar size="sm">
          <AvatarImage
            alt={comment.author?.login ?? "unknown"}
            src={comment.author?.avatarUrl}
          />
          <AvatarFallback>{comment.author?.login[0] ?? "?"}</AvatarFallback>
        </Avatar>
        <span className="font-medium text-foreground">
          {comment.author?.login ?? "unknown"}
        </span>
        <a
          className="hover:text-foreground hover:underline"
          href={comment.githubUrl}
          rel="noreferrer"
          target="_blank"
        >
          {commentDate(comment.createdAt)}
        </a>
        {comment.pending ? <Badge variant="outline">Pending</Badge> : null}
      </div>
      <CommentBody body={comment.body} originalLines={originalLines} />
    </div>
  );
}
