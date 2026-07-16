import type {
  PendingReview,
  ReviewEvent,
  SubmitReview,
} from "@sphynx/schema/pull-request-comments";
import { Button } from "@sphynx/ui/components/ui/button";
import { Textarea } from "@sphynx/ui/components/ui/textarea";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";

interface ReviewSubmitProps {
  onDiscard: () => void;
  onSubmit: (payload: SubmitReview) => void;
  pendingReview: PendingReview;
  submitting: boolean;
}

export function ReviewSubmit({
  onDiscard,
  onSubmit,
  pendingReview,
  submitting,
}: ReviewSubmitProps) {
  const [open, setOpen] = useState(false);
  const form = useForm({ defaultValues: { body: "" } });

  const submit = (event: ReviewEvent) => {
    const body = form.state.values.body.trim();
    onSubmit({ event, body: body === "" ? null : body });
    setOpen(false);
  };

  return (
    <div className="relative shrink-0">
      <Button
        className="h-7 px-2.5 text-xs"
        onClick={() => setOpen((current) => !current)}
        size="sm"
      >
        Finish review ({pendingReview.commentCount})
      </Button>
      {open ? (
        <div className="fade-in slide-in-from-top-1 absolute top-full right-0 z-50 mt-2 flex w-80 animate-in flex-col gap-2.5 rounded-lg border border-border bg-background p-3.5 shadow-md duration-150">
          <form.Field name="body">
            {(field) => (
              <Textarea
                autoFocus
                className="min-h-16 text-xs"
                onChange={(event) => field.handleChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    setOpen(false);
                  }
                }}
                placeholder="Leave a review summary (optional)"
                value={field.state.value}
              />
            )}
          </form.Field>
          <div className="flex flex-col gap-1.5">
            <Button
              className="h-7 text-xs"
              disabled={submitting}
              onClick={() => submit("APPROVE")}
              size="sm"
            >
              Approve
            </Button>
            <Button
              className="h-7 text-xs"
              disabled={submitting}
              onClick={() => submit("REQUEST_CHANGES")}
              size="sm"
              variant="outline"
            >
              Request changes
            </Button>
            <Button
              className="h-7 text-xs"
              disabled={submitting}
              onClick={() => submit("COMMENT")}
              size="sm"
              variant="outline"
            >
              Comment
            </Button>
          </div>
          <Button
            className="h-6 text-destructive text-xs hover:text-destructive"
            onClick={() => {
              onDiscard();
              setOpen(false);
            }}
            size="sm"
            variant="ghost"
          >
            Discard review
          </Button>
        </div>
      ) : null}
    </div>
  );
}
