import { useEffect, useRef } from "react";

interface VisiblePollOptions {
  enabled: boolean;
  intervalMs: number;
  onPoll: () => void;
}

export function useVisiblePoll({
  enabled,
  intervalMs,
  onPoll,
}: VisiblePollOptions) {
  const live = useRef(onPoll);
  useEffect(() => {
    live.current = onPoll;
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let timer: number | undefined;

    const stop = () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };

    const start = () => {
      stop();
      timer = window.setInterval(() => live.current(), intervalMs);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        live.current();
        start();
        return;
      }
      stop();
    };

    if (document.visibilityState === "visible") {
      start();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, intervalMs]);
}
