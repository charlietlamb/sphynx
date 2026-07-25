import { Databuddy } from "@databuddy/sdk/react";

const CLIENT_ID =
  import.meta.env.VITE_DATABUDDY_CLIENT_ID ??
  "b216cee9-23fb-4800-b2dc-dc56ba76487d";

export function DatabuddyAnalytics() {
  return (
    <Databuddy
      clientId={CLIENT_ID}
      disabled={import.meta.env.DEV}
      trackAttributes
      trackErrors
      trackHashChanges
      trackInteractions
      trackOutgoingLinks
      trackPerformance
      trackWebVitals
    />
  );
}
