import { ErrorCard } from "@/components/layout/error-card";
import { RootDocument } from "@/components/layout/root-document";

export function RootNotFound() {
  return (
    <RootDocument>
      <ErrorCard
        description="We couldn't find the page you were looking for."
        title="Page not found"
      />
    </RootDocument>
  );
}
