import {
  ChatCircleDotsIcon,
  CheckCircleIcon,
  ProhibitIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import type { ConversationVerdict } from "@sphynx/schema/pull-request-conversation";

export function VerdictIcon({ verdict }: { verdict: ConversationVerdict }) {
  switch (verdict) {
    case "approved":
      return (
        <CheckCircleIcon className="size-3.5 text-addition" weight="fill" />
      );
    case "changes-requested":
      return <XCircleIcon className="size-3.5 text-deletion" weight="fill" />;
    case "commented":
      return (
        <ChatCircleDotsIcon
          className="size-3.5 text-muted-foreground/60"
          weight="fill"
        />
      );
    default:
      return (
        <ProhibitIcon
          className="size-3.5 text-muted-foreground/60"
          weight="fill"
        />
      );
  }
}
