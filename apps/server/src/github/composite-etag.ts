interface RepoEtag {
  readonly etag: string;
  readonly key: string;
}

/**
 * Packs per-repo ETags into one opaque string the pipeline cache can store.
 *
 * A pipeline is built from many GitHub calls, so it has no single ETag of its
 * own. Composing them lets one conditional request per repo decide whether any
 * rebuild is needed at all.
 *
 * Sorted so the same set of tags always composes to the same string; an
 * unstable order would read as a change on every request.
 */
export const composeEtag = (parts: readonly RepoEtag[]) =>
  JSON.stringify(
    Object.fromEntries(
      [...parts]
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((part) => [part.key, part.etag])
    )
  );

/** Reads one repo's ETag back out of a composite, or null if absent. */
export const etagFor = (composite: string | null, key: string) => {
  if (!composite) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(composite);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const value = (parsed as Record<string, unknown>)[key];
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch {
    return null;
  }
};
