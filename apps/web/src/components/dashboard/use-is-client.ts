import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => undefined;

export function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
