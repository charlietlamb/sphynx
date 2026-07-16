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
    <div className="flex items-center gap-1.5 border-border border-t px-3.5 py-2">
      {canReply ? (
        <Button
          className="h-6 px-2 text-muted-foreground text-xs"
          onClick={onReply}
          size="sm"
          variant="ghost"
        >
          Reply
        </Button>
      ) : null}
      <div className="flex-1" />
      {onResolve ? (
        <Button
          className="h-6 px-2 text-muted-foreground text-xs"
          onClick={onResolve}
          size="sm"
          variant="ghost"
        >
          {resolved ? "Unresolve" : "Resolve conversation"}
        </Button>
      ) : null}
    </div>
  );
}
