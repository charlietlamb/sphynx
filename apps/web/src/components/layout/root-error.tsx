import type { ErrorComponentProps } from "@tanstack/react-router";
import { ErrorCard } from "@/components/layout/error-card";
import { RootDocument } from "@/components/layout/root-document";

export function RootErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <RootDocument>
      <ErrorCard
        description="Something went wrong while loading this page."
        detail={error.message}
        onRetry={reset}
        title="Unexpected error"
      />
    </RootDocument>
  );
}
