import { PlusMinusIcon } from "@phosphor-icons/react";
import { Button } from "@sphynx/ui/components/ui/button";
import { Textarea } from "@sphynx/ui/components/ui/textarea";
import { cn } from "@sphynx/ui/lib/utils";
import { useForm } from "@tanstack/react-form";

const TRAILING_NEWLINE = /\n?$/;

interface CommentComposerProps {
  busy: boolean;
  hasPendingReview: boolean;
  mode: "reply" | "thread";
  onCancel: () => void;
  onSubmit: (body: string, pending: boolean) => void;
  suggestionSeed: string;
  variant: "card" | "inline";
}

export function CommentComposer({
  busy,
  hasPendingReview,
  mode,
  onCancel,
  onSubmit,
  suggestionSeed,
  variant,
}: CommentComposerProps) {
  const primaryPending = mode === "thread";
  const form = useForm({
    defaultValues: { body: "" },
    onSubmit: ({ value }) => {
      const body = value.body.trim();
      if (body) {
        onSubmit(body, primaryPending);
      }
    },
  });

  const submitWith = (pending: boolean) => {
    const body = form.state.values.body.trim();
    if (body) {
      onSubmit(body, pending);
    }
  };

  const insertSuggestion = () => {
    const current = form.state.values.body;
    const template = `\`\`\`suggestion\n${suggestionSeed}\n\`\`\`\n`;
    form.setFieldValue(
      "body",
      current === ""
        ? template
        : `${current.replace(TRAILING_NEWLINE, "\n")}${template}`
    );
  };

  const primaryLabel = () => {
    if (mode === "reply") {
      return "Reply";
    }
    return hasPendingReview ? "Add review comment" : "Start a review";
  };

  return (
    <form
      className={cn(
        "flex flex-col gap-2.5 font-sans",
        variant === "card" &&
          "fade-in slide-in-from-top-1 my-2.5 mr-4 ml-1 max-w-3xl animate-in rounded-md border border-border bg-background p-3.5 shadow-xs duration-200",
        variant === "inline" && "border-border border-t px-3.5 py-3"
      )}
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.Field name="body">
        {(field) => (
          <Textarea
            autoFocus
            className="min-h-16 text-xs"
            onChange={(event) => field.handleChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                onCancel();
              }
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                form.handleSubmit();
              }
            }}
            placeholder="Leave a comment"
            value={field.state.value}
          />
        )}
      </form.Field>
      <div className="flex items-center gap-1.5">
        <Button
          className="h-6 px-2 text-muted-foreground text-xs"
          onClick={insertSuggestion}
          size="sm"
          title="Insert a suggested change"
          type="button"
          variant="ghost"
        >
          <PlusMinusIcon className="size-3.5" />
          Suggest change
        </Button>
        <div className="flex-1" />
        <Button
          className="h-6 px-2 text-xs"
          onClick={onCancel}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
        {mode === "thread" && !hasPendingReview ? (
          <Button
            className="h-6 px-2 text-xs"
            disabled={busy}
            onClick={() => submitWith(false)}
            size="sm"
            type="button"
            variant="outline"
          >
            Add single comment
          </Button>
        ) : null}
        <Button
          className="h-6 px-2 text-xs"
          disabled={busy}
          size="sm"
          type="submit"
        >
          {primaryLabel()}
        </Button>
      </div>
    </form>
  );
}
