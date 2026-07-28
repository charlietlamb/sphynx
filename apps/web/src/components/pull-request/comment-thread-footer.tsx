import { ArrowBendUpLeftIcon, CheckCircleIcon } from "@phosphor-icons/react";
import { Button } from "@sphynx/ui/components/ui/button";

interface CommentThreadFooterProps {
  canReply: boolean;
  onReply: () => void;
  onResolve: (() => void) | null;
  resolved: boolean;
}

export function CommentThreadFooter({
  canReply,
  onReply,
  onResolve,
  resolved,
}: CommentThreadFooterProps) {
  return (
    <div className="-ml-2 flex items-center gap-0.5 pt-0.5">
      {canReply ? (
        <Button
          className="h-7 gap-1.5 px-2 text-muted-foreground text-xs hover:text-foreground"
          onClick={onReply}
          size="sm"
          variant="ghost"
        >
          <ArrowBendUpLeftIcon className="size-3.5" />
          Reply
        </Button>
      ) : null}
      {onResolve ? (
        <Button
          className="h-7 gap-1.5 px-2 text-muted-foreground text-xs hover:text-foreground"
          onClick={onResolve}
          size="sm"
          variant="ghost"
        >
          <CheckCircleIcon className="size-3.5" weight="fill" />
          {resolved ? "Unresolve" : "Resolve"}
        </Button>
      ) : null}
    </div>
  );
}
