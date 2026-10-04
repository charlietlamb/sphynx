import type { EvalArtifactMetadata } from "@sphynx/schema/domain/eval-trial";
import {
  Message,
  MessageContent,
} from "@sphynx/ui/components/ai-elements/message";
import { CopyButton } from "@sphynx/ui/components/copy-button";
import { CodeContent } from "@sphynx/ui/components/ui/code-content";
import { SURFACE_BODY } from "@sphynx/ui/lib/surface";
import { ConversationWork } from "@/components/evals/conversation-work";
import {
  ConversationWrote,
  type TrialRef,
} from "@/components/evals/conversation-wrote";
import {
  type FileOpener,
  MarkdownProse,
} from "@/components/evals/markdown-prose";
import { MessageTook } from "@/components/evals/message-took";
import type { ConversationPart as Part } from "@/lib/evals/conversation";
import { structuredReply } from "@/lib/evals/structured-reply";

export interface Written {
  readonly artifacts: readonly EvalArtifactMetadata[];
  readonly trial: TrialRef;
}

export function ConversationPart({
  live,
  onOpenChange,
  open,
  openerFor,
  took,
  part,
  written,
}: {
  readonly live: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly openerFor: FileOpener;
  readonly took: number | null;
  readonly part: Part;
  readonly written: Written;
}) {
  if (part._tag === "said") {
    return (
      <Message from="user">
        <MessageContent>{part.text}</MessageContent>
        <MessageTook ms={took} />
      </Message>
    );
  }

  if (part._tag === "replied") {
    const structured = structuredReply(part.text);
    if (structured !== null) {
      return (
        <Message from="assistant">
          <div className={`group/answer relative w-full ${SURFACE_BODY}`}>
            <CopyButton
              className="absolute top-1.5 right-1.5 z-10 opacity-0 transition-opacity duration-150 ease-out focus-visible:opacity-100 group-hover/answer:opacity-100"
              label="Copy answer"
              size="inline"
              value={part.text}
            />
            <CodeContent
              code={structured}
              lang="json"
              maxHeight="max-h-96"
              wrap
            />
          </div>
          <MessageTook ms={took} />
        </Message>
      );
    }
    return (
      <Message from="assistant">
        <MessageContent>
          <MarkdownProse openerFor={openerFor} text={part.text} />
        </MessageContent>
        <MessageTook ms={took} />
      </Message>
    );
  }

  if (part._tag === "wrote") {
    return <ConversationWrote paths={part.paths} {...written} />;
  }

  return (
    <ConversationWork
      live={live}
      onOpenChange={onOpenChange}
      open={open}
      steps={part.steps}
    />
  );
}
