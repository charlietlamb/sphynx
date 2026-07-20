import { Button } from "@sphynx/ui/components/ui/button";
import { Textarea } from "@sphynx/ui/components/ui/textarea";
import { useForm } from "@tanstack/react-form";

interface ConversationComposerProps {
  busy: boolean;
  onSubmit: (body: string) => void;
}

export function ConversationComposer({
  busy,
  onSubmit,
}: ConversationComposerProps) {
  const form = useForm({
    defaultValues: { body: "" },
    onSubmit: ({ value }) => {
      const body = value.body.trim();
      if (body) {
        onSubmit(body);
        form.reset();
      }
    },
  });

  return (
    <form
      className="flex flex-col gap-2.5 rounded-md border border-border bg-background p-3.5"
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.Field name="body">
        {(field) => (
          <Textarea
            className="min-h-16 text-xs"
            onChange={(event) => field.handleChange(event.target.value)}
            onKeyDown={(event) => {
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
      <div className="flex items-center justify-end">
        <Button
          className="h-6 px-2 text-xs"
          disabled={busy}
          size="sm"
          type="submit"
        >
          Comment
        </Button>
      </div>
    </form>
  );
}
