/**
 * Wrap an async function so at most `limit` calls run at once; the rest queue.
 * Convex enforces a per-client cap on in-flight actions, so firing dozens of
 * `getFileContents` actions at mount (one per changed file) overruns it and the
 * whole websocket stalls for a minute. Draining them a few at a time keeps every
 * PR-page query — including the header's summary — responsive.
 */
export function limitConcurrency<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  limit: number
): (...args: Args) => Promise<Result> {
  let active = 0;
  const queue: (() => void)[] = [];

  const next = () => {
    if (active >= limit || queue.length === 0) {
      return;
    }
    active += 1;
    const run = queue.shift();
    run?.();
  };

  return (...args: Args) =>
    new Promise<Result>((resolve, reject) => {
      queue.push(() => {
        fn(...args)
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            next();
          });
      });
      next();
    });
}
