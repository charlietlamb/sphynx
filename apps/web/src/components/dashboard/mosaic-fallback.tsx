import { Spinner } from "@sphynx/ui/components/ui/spinner";

/**
 * Placeholder shown before the client-only `<Mosaic>` mounts (react-mosaic can't
 * SSR, and the saved layout lives in localStorage which the server can't read).
 * A neutral centered spinner — no guessing the layout server-side, so no flash
 * of the wrong arrangement. The Mosaic fades in with the correct layout once the
 * client mounts. Server and the first client render both show this, so there is
 * no hydration mismatch.
 */
export function MosaicFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <Spinner className="size-5 text-muted-foreground/40 [animation-duration:0.6s]" />
    </div>
  );
}
