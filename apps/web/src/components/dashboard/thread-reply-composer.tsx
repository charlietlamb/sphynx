import { Button } from "@sphynx/ui/components/ui/button";
import { Textarea } from "@sphynx/ui/components/ui/textarea";
import { useForm } from "@tanstack/react-form";

interface ThreadReplyComposerProps {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (body: string) => void;
}

export function ThreadReplyComposer({
  busy,
  onCancel,
  onSubmit,
}: ThreadReplyComposerProps) {
  const form = useForm({
    defaultValues: { body: "" },
    onSubmit: ({ value }) => {
      const body = value.body.trim();
      if (body) {
        onSubmit(body);
      }
    },
  });

  return (
    <form
      className="flex flex-col gap-1.5 pt-1"
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.Field name="body">
        {(field) => (
          <Textarea
            autoFocus
            className="min-h-12 text-xs"
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
            placeholder="Reply to this thread"
            value={field.state.value}
          />
        )}
      </form.Field>
      <div className="flex items-center justify-end gap-1.5">
        <Button
          className="h-6 px-2 text-xs"
          onClick={onCancel}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
        <Button
          className="h-6 px-2 text-xs"
          disabled={busy}
          size="sm"
          type="submit"
        >
          Reply
        </Button>
      </div>
    </form>
  );
}
