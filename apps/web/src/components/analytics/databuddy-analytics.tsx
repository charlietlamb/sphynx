import { ClientOnly } from "@tanstack/react-router";
import { lazy } from "react";

const CLIENT_ID =
  import.meta.env.VITE_DATABUDDY_CLIENT_ID ??
  "b216cee9-23fb-4800-b2dc-dc56ba76487d";

const Databuddy = lazy(() =>
  import("@databuddy/sdk/react").then((module) => ({
    default: module.Databuddy,
  }))
);

export function DatabuddyAnalytics() {
  return (
    <ClientOnly fallback={null}>
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
    </ClientOnly>
  );
}
