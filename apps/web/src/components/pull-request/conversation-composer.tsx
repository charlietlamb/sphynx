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
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.Field name="body">
        {(field) => (
          <Textarea
            className="max-h-40 min-h-9 flex-1 resize-none py-2 text-[13px] leading-relaxed"
            onChange={(event) => field.handleChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                form.handleSubmit();
              }
            }}
            placeholder="Leave a comment…"
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.body.trim() !== ""}>
        {(hasText) => (
          <Button
            className="h-9 shrink-0"
            disabled={busy || !hasText}
            size="sm"
            type="submit"
          >
            Comment
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
