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
    <div className="flex items-center gap-2 border-border border-t px-4 py-2.5">
      {canReply ? (
        <Button
          className="h-7 gap-1.5 px-2.5 text-xs"
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
          className="h-7 gap-1.5 px-2.5 text-xs"
          onClick={onResolve}
          size="sm"
          variant="outline"
        >
          <CheckCircleIcon className="size-3.5" weight="fill" />
          {resolved ? "Unresolve" : "Resolve"}
        </Button>
      ) : null}
    </div>
  );
}
