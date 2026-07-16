import type { ErrorComponentProps } from "@tanstack/react-router";
import { ErrorCard } from "@/components/layout/error-card";

function isParseError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    (error as { _tag: unknown })._tag === "ParseError"
  );
}

export function PullRequestUrlError({ error }: ErrorComponentProps) {
  if (isParseError(error)) {
    return (
      <ErrorCard
        description="That doesn't look like a valid pull request URL. Expected /:owner/:repo/pull/:number."
        title="Invalid pull request URL"
      />
    );
  }
  return (
    <ErrorCard
      description="We couldn't render this pull request."
      detail={error instanceof Error ? error.message : String(error)}
      title="Something went wrong"
    />
  );
}
